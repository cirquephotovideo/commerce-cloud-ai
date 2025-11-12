import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchResult {
  analysis_id: string;
  enrichment_id: string;
  matched_on: string;
  confidence_score: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { job_id, offset = 0, batch_size = 100 } = await req.json();

    // Get product analyses without Amazon links
    const { data: analyses, error: analysesError } = await supabase
      .from('product_analyses')
      .select('id, ean, analysis_result')
      .eq('user_id', user.id)
      .not('ean', 'is', null)
      .range(offset, offset + batch_size - 1);

    if (analysesError) {
      console.error('Error fetching analyses:', analysesError);
      throw analysesError;
    }

    // Get Code2ASIN enrichments
    const { data: enrichments, error: enrichmentsError } = await supabase
      .from('code2asin_enrichments')
      .select('id, ean, asin, title, brand')
      .eq('user_id', user.id)
      .not('ean', 'is', null);

    if (enrichmentsError) {
      console.error('Error fetching enrichments:', enrichmentsError);
      throw enrichmentsError;
    }

    // Create EAN index for fast lookup
    const enrichmentsByEan = new Map<string, any[]>();
    enrichments?.forEach(enr => {
      if (enr.ean) {
        if (!enrichmentsByEan.has(enr.ean)) {
          enrichmentsByEan.set(enr.ean, []);
        }
        enrichmentsByEan.get(enr.ean)!.push(enr);
      }
    });

    const matches: MatchResult[] = [];

    // Match products with enrichments
    for (const analysis of analyses || []) {
      if (!analysis.ean) continue;

      // Check if link already exists
      const { data: existingLink } = await supabase
        .from('product_amazon_links')
        .select('id')
        .eq('analysis_id', analysis.id)
        .single();

      if (existingLink) continue;

      // Try to match by EAN
      const enrichmentsForEan = enrichmentsByEan.get(analysis.ean);
      if (enrichmentsForEan && enrichmentsForEan.length > 0) {
        // Use first match (could be improved with better matching logic)
        const enrichment = enrichmentsForEan[0];
        
        matches.push({
          analysis_id: analysis.id,
          enrichment_id: enrichment.id,
          matched_on: 'ean',
          confidence_score: 100
        });
      }
    }

    // Insert matches into database
    if (matches.length > 0) {
      const linksToInsert = matches.map(match => ({
        user_id: user.id,
        analysis_id: match.analysis_id,
        enrichment_id: match.enrichment_id,
        link_type: 'automatic',
        confidence_score: match.confidence_score,
        matched_on: match.matched_on
      }));

      const { error: insertError } = await supabase
        .from('product_amazon_links')
        .insert(linksToInsert);

      if (insertError) {
        console.error('Error inserting links:', insertError);
        throw insertError;
      }
    }

    // Update job progress
    if (job_id) {
      const newOffset = offset + batch_size;
      const isComplete = !analyses || analyses.length < batch_size;

      await supabase
        .from('amazon_auto_link_jobs')
        .update({
          processed_count: newOffset,
          links_created: matches.length,
          current_offset: newOffset,
          status: isComplete ? 'completed' : 'processing',
          completed_at: isComplete ? new Date().toISOString() : null
        })
        .eq('id', job_id);

      // If not complete, invoke next batch
      if (!isComplete) {
        await supabase.functions.invoke('process-amazon-auto-link', {
          body: {
            job_id,
            offset: newOffset,
            batch_size
          }
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        matches_found: matches.length,
        processed: analyses?.length || 0,
        offset: offset + batch_size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-amazon-auto-link:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
