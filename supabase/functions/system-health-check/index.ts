import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Starting system health check...');

    const checks: any = {};
    const recommendations: string[] = [];
    let overallStatus: 'ok' | 'warning' | 'critical' = 'ok';

    // 1. Database connectivity check
    const dbStartTime = Date.now();
    const { data: dbTest, error: dbError } = await supabase
      .from('supplier_products')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    
    const dbLatency = Date.now() - dbStartTime;
    
    if (dbError) {
      checks.database = { status: 'critical', error: dbError.message, latency: dbLatency };
      overallStatus = 'critical';
    } else {
      checks.database = { status: 'ok', latency: dbLatency };
    }

    // 2. Queue health check
    const [pending, processing, completed24h, failed24h] = await Promise.all([
      supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('enrichment_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('enrichment_queue').select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString()),
      supabase.from('enrichment_queue').select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString()),
    ]);

    // Check for stuck products (enriching status for >10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: stuckCount } = await supabase
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'enriching')
      .lt('updated_at', tenMinutesAgo);

    const queueMetrics = {
      pending: pending.count || 0,
      processing: processing.count || 0,
      completed24h: completed24h.count || 0,
      failed24h: failed24h.count || 0,
      stuck: stuckCount || 0,
    };

    const successRate = queueMetrics.completed24h + queueMetrics.failed24h > 0
      ? (queueMetrics.completed24h / (queueMetrics.completed24h + queueMetrics.failed24h)) * 100
      : 100;

    let queueStatus: 'ok' | 'warning' | 'critical' = 'ok';
    if (queueMetrics.stuck > 10000) {
      queueStatus = 'critical';
      overallStatus = 'critical';
      recommendations.push(`🚨 Critical: ${queueMetrics.stuck} stuck products detected. Run unlock-all-stuck-products immediately.`);
    } else if (queueMetrics.stuck > 1000) {
      queueStatus = 'warning';
      if (overallStatus === 'ok') overallStatus = 'warning';
      recommendations.push(`⚠️ Warning: ${queueMetrics.stuck} stuck products detected. Consider running unlock-all-stuck-products.`);
    }

    if (successRate < 90 && (queueMetrics.completed24h + queueMetrics.failed24h) > 10) {
      queueStatus = queueStatus === 'critical' ? 'critical' : 'warning';
      if (overallStatus === 'ok') overallStatus = 'warning';
      recommendations.push(`⚠️ Success rate is ${successRate.toFixed(1)}% (below 90% threshold).`);
    }

    checks.queue = {
      status: queueStatus,
      metrics: queueMetrics,
      successRate: successRate.toFixed(1) + '%',
    };

    // 3. Check for orphaned products (enriching without queue tasks)
    const { data: enrichingProducts } = await supabase
      .from('supplier_products')
      .select('id')
      .eq('enrichment_status', 'enriching')
      .limit(100);

    let orphanedCount = 0;
    if (enrichingProducts && enrichingProducts.length > 0) {
      const productIds = enrichingProducts.map(p => p.id);
      const { data: queueTasks } = await supabase
        .from('enrichment_queue')
        .select('product_id')
        .in('product_id', productIds)
        .in('status', ['pending', 'processing']);

      const queueProductIds = new Set(queueTasks?.map(t => t.product_id) || []);
      orphanedCount = productIds.filter(id => !queueProductIds.has(id)).length;

      if (orphanedCount > 0) {
        recommendations.push(`ℹ️ ${orphanedCount} orphaned products detected (enriching without queue tasks).`);
      }
    }

    // 4. Amazon credentials check
    const { data: amazonCreds } = await supabase
      .from('amazon_credentials')
      .select('expires_at')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (amazonCreds) {
      const expiresAt = new Date(amazonCreds.expires_at);
      const daysUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      let credStatus: 'ok' | 'warning' | 'critical' = 'ok';
      if (daysUntilExpiry < 0) {
        credStatus = 'critical';
        overallStatus = 'critical';
        recommendations.push('🚨 Amazon credentials have expired! Re-authenticate immediately.');
      } else if (daysUntilExpiry < 7) {
        credStatus = 'warning';
        if (overallStatus === 'ok') overallStatus = 'warning';
        recommendations.push(`⚠️ Amazon credentials expire in ${daysUntilExpiry} days. Re-authenticate soon.`);
      }

      checks.amazon_credentials = {
        status: credStatus,
        expires_at: amazonCreds.expires_at,
        days_until_expiry: daysUntilExpiry,
      };
    } else {
      checks.amazon_credentials = {
        status: 'warning',
        message: 'No Amazon credentials configured',
      };
      if (overallStatus === 'ok') overallStatus = 'warning';
    }

    // 5. Recent errors check (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentErrorsCount } = await supabase
      .from('enrichment_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', oneHourAgo);

    checks.recent_errors = {
      status: (recentErrorsCount || 0) > 100 ? 'warning' : 'ok',
      count: recentErrorsCount || 0,
      timeframe: '1 hour',
    };

    if ((recentErrorsCount || 0) > 100) {
      if (overallStatus === 'ok') overallStatus = 'warning';
      recommendations.push(`⚠️ High error rate: ${recentErrorsCount} failures in the last hour.`);
    }

    console.log(`✅ Health check completed. Status: ${overallStatus}`);

    return new Response(
      JSON.stringify({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks,
        recommendations,
        summary: {
          overall_status: overallStatus,
          queue_health: queueStatus,
          stuck_products: queueMetrics.stuck,
          success_rate_24h: successRate.toFixed(1) + '%',
          orphaned_products: orphanedCount,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Health check error:', error);
    return new Response(
      JSON.stringify({ 
        status: 'critical',
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});