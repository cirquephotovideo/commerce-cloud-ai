import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, productName, competitorSiteIds } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Non authentifié");

    const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!GOOGLE_SEARCH_API_KEY || !GOOGLE_SEARCH_CX) {
      throw new Error("Google Search API non configurée");
    }

    // Récupérer les sites concurrents actifs
    const { data: competitorSites, error: sitesError } = await supabase
      .from('competitor_sites')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('id', competitorSiteIds || []);

    if (sitesError) throw sitesError;

    const results: any[] = [];

    // Pour chaque site concurrent, effectuer une recherche web
    for (const site of competitorSites || []) {
      const searchQuery = `site:${site.site_url} ${productName}`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(searchQuery)}`;
      
      console.log('Recherche sur:', site.site_name, searchQuery);

      try {
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.items && searchData.items.length > 0) {
          // Analyser les résultats avec l'IA pour extraire prix et stock
          const analysisPrompt = `Extrais les informations de prix et stock de ces résultats de recherche: ${JSON.stringify(searchData.items.slice(0, 3))}
          
          Format JSON strict:
          {
            "products": [{
              "name": "",
              "price": 0,
              "currency": "EUR",
              "stock_status": "in_stock",
              "url": ""
            }]
          }`;

          const aiResult = await callAIWithFallback({
            model: 'google/gemini-2.5-flash',
            messages: [{ role: 'user', content: analysisPrompt }],
            temperature: 0.3,
            max_tokens: 1000
          });

          if (!aiResult.success || !aiResult.content) {
            console.error(`AI failed for ${site.site_name}:`, aiResult.error);
            continue;
          }

          let extractedData: any;
          try {
            const contentStr = typeof aiResult.content === 'string' ? aiResult.content : JSON.stringify(aiResult.content);
            extractedData = JSON.parse(contentStr);
          } catch (e) {
            console.error('Failed to parse AI response JSON:', e);
            continue;
          }

          // Sauvegarder les données de monitoring
          for (const product of extractedData.products || []) {
            const { error: insertError } = await supabase
              .from('price_monitoring')
              .insert({
                user_id: user.id,
                product_name: productName,
                product_url: product.url,
                competitor_site_id: site.id,
                current_price: product.price,
                stock_status: product.stock_status,
                scraped_at: new Date().toISOString(),
              });

            if (!insertError) {
              results.push({
                site: site.site_name,
                product: product,
                scrapedAt: new Date().toISOString(),
              });
            }
          }
        }

        // Mettre à jour la date de dernier scraping
        await supabase
          .from('competitor_sites')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('id', site.id);

      } catch (error) {
        console.error(`Erreur scraping ${site.site_name}:`, error);
      }
    }

    // Créer des alertes si détection de changements importants
    if (results.length > 0) {
      const { error: alertError } = await supabase
        .from('user_alerts')
        .insert({
          user_id: user.id,
          alert_type: 'price_monitoring',
          alert_data: { results, productName, timestamp: new Date().toISOString() },
          priority: 'medium',
        });

      if (alertError) console.error('Erreur création alerte:', alertError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      message: `${results.length} produits trouvés sur ${competitorSites?.length || 0} sites`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erreur market intelligence:', error);
    // Return 200 with structured error to avoid "non-2xx status code" errors in UI
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      code: 'INTERNAL_ERROR'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});