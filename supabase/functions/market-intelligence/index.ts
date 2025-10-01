import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

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

          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{ role: 'user', content: analysisPrompt }],
            }),
          });

          const aiData = await aiResponse.json();
          const extractedData = JSON.parse(aiData.choices[0].message.content);

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
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});