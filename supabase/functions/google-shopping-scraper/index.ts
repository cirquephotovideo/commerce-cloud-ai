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
    const { productName, maxResults = 10 } = await req.json();
    
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

    console.log('Recherche Google Shopping pour:', productName);

    // Recherche sur Google Shopping via Custom Search API
    const searchQuery = `${productName}`;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(searchQuery)}&num=${maxResults}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    console.log('Résultats trouvés:', searchData.items?.length || 0);

    if (!searchData.items || searchData.items.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        results: [],
        message: "Aucun produit trouvé sur Google Shopping"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyser chaque résultat avec l'IA pour extraire les informations produit
    const analysisPrompt = `Analyse ces résultats de recherche Google Shopping et extrais les informations produit de manière structurée.

Résultats: ${JSON.stringify(searchData.items.slice(0, maxResults))}

Pour chaque produit trouvé, extrais:
- title: Nom du produit
- price: Prix (nombre uniquement, sans devise)
- currency: Devise (EUR, USD, etc.)
- merchant: Nom du vendeur/site
- url: URL du produit
- image: URL de l'image si disponible
- description: Description courte du produit
- availability: Disponibilité (in_stock, out_of_stock, limited)
- rating: Note si disponible (nombre entre 0 et 5)
- reviews_count: Nombre d'avis si disponible

Format JSON strict:
{
  "products": [{
    "title": "",
    "price": 0,
    "currency": "EUR",
    "merchant": "",
    "url": "",
    "image": "",
    "description": "",
    "availability": "in_stock",
    "rating": 0,
    "reviews_count": 0
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
    let extractedData;
    
    try {
      const content = aiData.choices[0].message.content;
      // Extraire le JSON de la réponse (enlever les balises markdown si présentes)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { products: [] };
    } catch (parseError) {
      console.error('Erreur parsing AI response:', parseError);
      extractedData = { products: [] };
    }

    // Sauvegarder les résultats dans la base de données
    const results = [];
    
    for (const product of extractedData.products || []) {
      if (!product.title || !product.price) continue;

      // Sauvegarder dans price_monitoring
      const { data: inserted, error: insertError } = await supabase
        .from('price_monitoring')
        .insert({
          user_id: user.id,
          product_name: product.title,
          product_url: product.url || '',
          competitor_site_id: null, // Google Shopping direct
          current_price: product.price,
          stock_status: product.availability || 'in_stock',
          scraped_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!insertError && inserted) {
        results.push({
          ...product,
          id: inserted.id,
          source: 'google_shopping',
          scraped_at: inserted.scraped_at,
        });
      }
    }

    // Créer une alerte pour l'utilisateur
    if (results.length > 0) {
      await supabase
        .from('user_alerts')
        .insert({
          user_id: user.id,
          alert_type: 'google_shopping_results',
          alert_data: { 
            productName, 
            results_count: results.length,
            lowest_price: Math.min(...results.map(r => r.price)),
            highest_price: Math.max(...results.map(r => r.price)),
            timestamp: new Date().toISOString() 
          },
          priority: 'medium',
        });
    }

    // Créer une tendance marché
    if (results.length >= 3) {
      const prices = results.map(r => r.price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      
      await supabase
        .from('market_trends')
        .insert({
          user_id: user.id,
          trend_type: 'price_analysis',
          product_category: productName,
          trend_data: {
            average_price: avgPrice,
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            merchants_count: new Set(results.map(r => r.merchant)).size,
            results_count: results.length,
          },
          confidence_score: 0.85,
        });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      statistics: {
        total_found: results.length,
        average_price: results.length > 0 ? 
          (results.reduce((sum, r) => sum + r.price, 0) / results.length).toFixed(2) : 0,
        lowest_price: results.length > 0 ? Math.min(...results.map(r => r.price)) : 0,
        highest_price: results.length > 0 ? Math.max(...results.map(r => r.price)) : 0,
        merchants: [...new Set(results.map(r => r.merchant))],
      },
      message: `${results.length} produits trouvés sur Google Shopping`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erreur Google Shopping scraper:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});