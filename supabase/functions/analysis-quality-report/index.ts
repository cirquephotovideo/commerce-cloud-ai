import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QualityMetrics {
  total_analyses: number;
  complete_analyses: number;
  incomplete_analyses: number;
  avg_completeness_score: number;
  most_missing_fields: Array<{ field: string; count: number }>;
  avg_enrichment_time_seconds: number;
  provider_success_rates: Record<string, { total: number; successful: number; rate: number }>;
  quality_by_category: Record<string, { count: number; avg_score: number }>;
  recent_failures: Array<{
    id: string;
    product_name: string;
    missing_fields: string[];
    created_at: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get time range from query params (default: last 7 days)
    const url = new URL(req.url);
    const daysBack = parseInt(url.searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch analyses from the period
    const { data: analyses, error } = await supabase
      .from('product_analyses')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calculate metrics
    const metrics: QualityMetrics = {
      total_analyses: analyses?.length || 0,
      complete_analyses: 0,
      incomplete_analyses: 0,
      avg_completeness_score: 0,
      most_missing_fields: [],
      avg_enrichment_time_seconds: 0,
      provider_success_rates: {},
      quality_by_category: {},
      recent_failures: []
    };

    if (!analyses || analyses.length === 0) {
      return new Response(JSON.stringify(metrics), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Track missing fields
    const missingFieldsCount: Record<string, number> = {};
    let totalCompletenessScore = 0;
    let totalEnrichmentTime = 0;
    let enrichmentTimeCount = 0;

    // Track provider performance
    const providerStats: Record<string, { total: number; successful: number }> = {};

    // Track category quality
    const categoryStats: Record<string, { total: number; scoreSum: number }> = {};

    for (const analysis of analyses) {
      const analysisResult = analysis.analysis_result || {};
      
      // Check if analysis is complete
      const isComplete = !analysisResult._incomplete && !analysisResult.parsing_error;
      
      if (isComplete) {
        metrics.complete_analyses++;
      } else {
        metrics.incomplete_analyses++;
        
        // Track missing fields
        if (analysisResult._missing_fields) {
          for (const field of analysisResult._missing_fields) {
            missingFieldsCount[field] = (missingFieldsCount[field] || 0) + 1;
          }
        }
        
        // Add to recent failures
        if (metrics.recent_failures.length < 20) {
          metrics.recent_failures.push({
            id: analysis.id,
            product_name: analysisResult.product_name || 'Unknown',
            missing_fields: analysisResult._missing_fields || [],
            created_at: analysis.created_at
          });
        }
      }
      
      // Calculate completeness score
      const score = analysisResult.global_report?.overall_score || 
                    (isComplete ? 80 : 50);
      totalCompletenessScore += score;
      
      // Track enrichment time
      if (analysis.created_at && analysis.updated_at) {
        const created = new Date(analysis.created_at);
        const updated = new Date(analysis.updated_at);
        const diffSeconds = (updated.getTime() - created.getTime()) / 1000;
        if (diffSeconds > 0 && diffSeconds < 300) { // Only count if < 5 minutes
          totalEnrichmentTime += diffSeconds;
          enrichmentTimeCount++;
        }
      }
      
      // Track provider stats
      const provider = analysisResult._provider || analysisResult.usedProvider || 'unknown';
      if (!providerStats[provider]) {
        providerStats[provider] = { total: 0, successful: 0 };
      }
      providerStats[provider].total++;
      if (isComplete) {
        providerStats[provider].successful++;
      }
      
      // Track category stats
      const category = analysisResult.tags_categories?.primary_category || 'Uncategorized';
      if (!categoryStats[category]) {
        categoryStats[category] = { total: 0, scoreSum: 0 };
      }
      categoryStats[category].total++;
      categoryStats[category].scoreSum += score;
    }

    // Calculate averages
    metrics.avg_completeness_score = Math.round(totalCompletenessScore / analyses.length);
    metrics.avg_enrichment_time_seconds = enrichmentTimeCount > 0
      ? Math.round(totalEnrichmentTime / enrichmentTimeCount)
      : 0;

    // Sort and get top missing fields
    metrics.most_missing_fields = Object.entries(missingFieldsCount)
      .map(([field, count]) => ({ field, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate provider success rates
    for (const [provider, stats] of Object.entries(providerStats)) {
      metrics.provider_success_rates[provider] = {
        total: stats.total,
        successful: stats.successful,
        rate: stats.total > 0 ? Math.round((stats.successful / stats.total) * 100) : 0
      };
    }

    // Calculate category quality
    for (const [category, stats] of Object.entries(categoryStats)) {
      metrics.quality_by_category[category] = {
        count: stats.total,
        avg_score: Math.round(stats.scoreSum / stats.total)
      };
    }

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating quality report:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
