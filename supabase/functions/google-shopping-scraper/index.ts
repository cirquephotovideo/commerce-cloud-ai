import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductResult {
  title: string;
  price: number | null;
  currency: string;
  merchant: string;
  url: string;
  image: string | null;
  description: string | null;
  availability: string;
  rating: number | null;
  reviews_count: number | null;
}

// Fonction pour rechercher avec Serper.dev Shopping API
async function searchWithSerper(productName: string, maxResults: number, apiKey: string): Promise<ProductResult[]> {
  console.log('Serper.dev - Recherche pour:', productName);
  
  const response = await fetch('https://google.serper.dev/shopping', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: productName,
      num: maxResults,
      gl: 'fr', // Pays
      hl: 'fr', // Langue
    }),
  });

  if (!response.ok) {
    console.error('Erreur Serper.dev:', response.status);
    return [];
  }

  const data = await response.json();
  console.log('Serper.dev - Résultats:', data.shopping?.length || 0);

  const results: ProductResult[] = [];
  
  for (const item of data.shopping || []) {
    results.push({
      title: item.title || '',
      price: parseFloat(item.price?.replace(/[^0-9.,]/g, '').replace(',', '.')) || null,
      currency: item.currency || 'EUR',
      merchant: item.source || 'Unknown',
      url: item.link || '',
      image: item.imageUrl || null,
      description: item.snippet || null,
      availability: item.deliveryInfo ? 'in_stock' : 'unknown',
      rating: item.rating || null,
      reviews_count: item.ratingCount || null,
    });
  }

  return results;
}

// Fonction pour extraire les données depuis une URL directe
async function extractFromUrl(url: string, lovableApiKey: string): Promise<ProductResult[]> {
  console.log('Direct URL - Extraction depuis:', url);
  
  try {
    // Fetch HTML avec User-Agent desktop
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error('Erreur fetch URL:', response.status);
      return [];
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc) {
      console.error('Erreur parsing HTML');
      return [];
    }

    // Extraction JSON-LD
    let jsonLdData: any = null;
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Product' || (Array.isArray(data) && data.find((d: any) => d['@type'] === 'Product'))) {
          jsonLdData = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'Product') : data;
          console.log('JSON-LD Product trouvé');
          break;
        }
      } catch (e) {
        // Ignorer les erreurs de parsing JSON-LD
      }
    }

    // Extraction meta tags
    const getMetaContent = (name: string) => {
      const meta = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      return meta?.getAttribute('content') || '';
    };

    const title = jsonLdData?.name || getMetaContent('og:title') || doc.querySelector('title')?.textContent || '';
    const image = jsonLdData?.image || getMetaContent('og:image') || '';
    const description = jsonLdData?.description || getMetaContent('og:description') || getMetaContent('description') || '';
    
    // Extraction prix depuis JSON-LD Offer
    let price: number | null = null;
    let currency = 'EUR';
    let availability = 'unknown';
    
    if (jsonLdData?.offers) {
      const offer = Array.isArray(jsonLdData.offers) ? jsonLdData.offers[0] : jsonLdData.offers;
      price = parseFloat(offer.price) || null;
      currency = offer.priceCurrency || 'EUR';
      availability = offer.availability?.includes('InStock') ? 'in_stock' : 
                     offer.availability?.includes('OutOfStock') ? 'out_of_stock' : 'unknown';
    }

    // Extraction rating
    let rating: number | null = null;
    let reviewsCount: number | null = null;
    
    if (jsonLdData?.aggregateRating) {
      rating = parseFloat(jsonLdData.aggregateRating.ratingValue) || null;
      reviewsCount = parseInt(jsonLdData.aggregateRating.reviewCount) || null;
    }

    // Extraction merchant depuis l'URL
    const urlObj = new URL(url);
    const merchant = urlObj.hostname.replace('www.', '');

    // Si données incomplètes, utiliser l'IA pour compléter
    if (!price || !title) {
      console.log('Données incomplètes, analyse IA...');
      
      const aiPrompt = `Extrais les informations produit de cette page HTML (résumé):
      
Title: ${doc.querySelector('title')?.textContent || ''}
URL: ${url}
Body text: ${doc.querySelector('body')?.textContent?.slice(0, 2000) || ''}

Extrait au format JSON:
{
  "title": "nom exact du produit",
  "price": nombre_uniquement,
  "currency": "EUR|USD|etc",
  "description": "description courte",
  "availability": "in_stock|out_of_stock|unknown"
}`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: aiPrompt }],
        }),
      });

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        price = price || extracted.price;
        currency = currency || extracted.currency || 'EUR';
        availability = availability === 'unknown' ? (extracted.availability || 'unknown') : availability;
      }
    }

    return [{
      title,
      price,
      currency,
      merchant,
      url,
      image,
      description,
      availability,
      rating,
      reviews_count: reviewsCount,
    }];

  } catch (error) {
    console.error('Erreur extraction URL:', error);
    return [];
  }
}

// Fonction pour parser les résultats Google Custom Search avec IA
async function parseGoogleResults(items: any[], lovableApiKey: string): Promise<ProductResult[]> {
  const analysisPrompt = `Analyse ces résultats de recherche Google et extrais les informations produit de manière structurée.

Résultats: ${JSON.stringify(items)}

Pour chaque produit trouvé, extrais:
- title: Nom du produit
- price: Prix (nombre uniquement, sans devise)
- currency: Devise (EUR, USD, etc.)
- merchant: Nom du vendeur/site
- url: URL du produit
- image: URL de l'image si disponible
- description: Description courte du produit
- availability: Disponibilité (in_stock, out_of_stock, unknown)
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
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: analysisPrompt }],
    }),
  });

  const aiData = await aiResponse.json();
  
  try {
    const content = aiData.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { products: [] };
    return extractedData.products || [];
  } catch (parseError) {
    console.error('Erreur parsing AI response:', parseError);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let provider = 'unknown';

  try {
    const { productName, productUrl, maxResults = 10 } = await req.json();

    // Authentification
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Non authentifié');

    const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX');
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    let results: ProductResult[] = [];

    // MODE 1: URL directe fournie
    if (productUrl) {
      provider = 'Direct URL';
      console.log('📍 Mode Direct URL:', productUrl);
      results = await extractFromUrl(productUrl, LOVABLE_API_KEY!);
    }
    // MODE 2: Recherche par nom de produit
    else if (productName) {
      // Tentative Google Custom Search
      if (GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_CX) {
        provider = 'Google Custom Search';
        console.log('🔍 Tentative Google Custom Search pour:', productName);
        
        const searchQuery = `${productName} acheter prix`;
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(searchQuery)}&num=${maxResults}`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (searchData.error) {
          console.error('❌ Erreur Google Custom Search:', searchData.error.message);
          provider = 'Google CSE (failed)';
          
          // Fallback vers Serper.dev
          if (SERPER_API_KEY) {
            provider = 'Serper.dev (fallback)';
            console.log('🔄 Fallback vers Serper.dev Shopping API');
            results = await searchWithSerper(productName, maxResults, SERPER_API_KEY);
          } else {
            return new Response(
              JSON.stringify({ 
                error: 'Google Custom Search API désactivée ou non configurée',
                details: searchData.error.message,
                suggestion: 'Activez l\'API Custom Search sur Google Cloud Console ou configurez SERPER_API_KEY pour utiliser le fallback automatique',
                helpUrl: searchData.error.details?.[0]?.metadata?.activationUrl
              }),
              { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else if (searchData.items && searchData.items.length > 0) {
          console.log('✅ Google CSE - Résultats trouvés:', searchData.items.length);
          results = await parseGoogleResults(searchData.items, LOVABLE_API_KEY!);
        } else {
          console.log('⚠️ Google CSE - Aucun résultat');
          if (SERPER_API_KEY) {
            provider = 'Serper.dev (no results)';
            console.log('🔄 Tentative Serper.dev');
            results = await searchWithSerper(productName, maxResults, SERPER_API_KEY);
          }
        }
      }
      // Utiliser directement Serper.dev si pas de clés Google
      else if (SERPER_API_KEY) {
        provider = 'Serper.dev';
        console.log('🛍️ Recherche directe avec Serper.dev pour:', productName);
        results = await searchWithSerper(productName, maxResults, SERPER_API_KEY);
      } else {
        throw new Error('Aucune API de recherche configurée (Google Custom Search ou Serper.dev)');
      }
    } else {
      throw new Error('productName ou productUrl requis');
    }

    console.log(`📊 ${results.length} produits extraits avec ${provider}`);

    // Sauvegarder les résultats dans la base de données
    const savedResults = [];
    
    for (const product of results) {
      if (!product.title || !product.price) continue;

      // Détecter ou créer le competitor_site
      let competitorSiteId = null;
      if (product.merchant) {
        const { data: existingSite } = await supabase
          .from('competitor_sites')
          .select('id')
          .eq('user_id', user.id)
          .ilike('site_name', `%${product.merchant}%`)
          .single();

        if (existingSite) {
          competitorSiteId = existingSite.id;
        } else {
          const { data: newSite } = await supabase
            .from('competitor_sites')
            .insert({
              user_id: user.id,
              site_name: product.merchant,
              site_url: product.url,
              site_type: 'e-commerce',
              is_active: true,
            })
            .select()
            .single();
          
          competitorSiteId = newSite?.id;
        }
      }

      // Sauvegarder dans price_monitoring avec tous les champs disponibles
      const { data: inserted, error: insertError } = await supabase
        .from('price_monitoring')
        .insert({
          user_id: user.id,
          product_name: product.title,
          product_url: product.url,
          competitor_site_id: competitorSiteId,
          current_price: product.price,
          stock_status: product.availability,
          image_url: product.image || null,
          description: product.description || null,
          rating: product.rating || null,
          reviews_count: product.reviews_count || null,
          scraped_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!insertError && inserted) {
        savedResults.push({
          ...product,
          id: inserted.id,
          source: provider,
          scraped_at: inserted.scraped_at,
        });
      }
    }

    // Créer une alerte pour l'utilisateur
    if (savedResults.length > 0) {
      await supabase
        .from('user_alerts')
        .insert({
          user_id: user.id,
          alert_type: 'shopping_results',
          alert_data: { 
            query: productName || productUrl,
            provider,
            results_count: savedResults.length,
            lowest_price: Math.min(...savedResults.map(r => r.price!)),
            highest_price: Math.max(...savedResults.map(r => r.price!)),
            timestamp: new Date().toISOString() 
          },
          priority: 'medium',
        });
    }

    // Créer une tendance marché
    if (savedResults.length >= 3) {
      const prices = savedResults.map(r => r.price!);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      
      await supabase
        .from('market_trends')
        .insert({
          user_id: user.id,
          trend_type: 'price_analysis',
          product_category: productName || 'URL directe',
          trend_data: {
            provider,
            average_price: avgPrice,
            min_price: Math.min(...prices),
            max_price: Math.max(...prices),
            merchants_count: new Set(savedResults.map(r => r.merchant)).size,
            results_count: savedResults.length,
          },
          confidence_score: 0.85,
        });
    }

    const elapsed = Date.now() - startTime;
    console.log(`⏱️ Traitement terminé en ${elapsed}ms`);

    return new Response(JSON.stringify({ 
      success: true, 
      results: savedResults,
      metadata: {
        provider,
        response_time_ms: elapsed,
        saved_count: savedResults.length,
      },
      statistics: {
        total_found: savedResults.length,
        average_price: savedResults.length > 0 ? 
          (savedResults.reduce((sum, r) => sum + (r.price || 0), 0) / savedResults.length).toFixed(2) : 0,
        lowest_price: savedResults.length > 0 ? Math.min(...savedResults.map(r => r.price || 0)) : 0,
        highest_price: savedResults.length > 0 ? Math.max(...savedResults.map(r => r.price || 0)) : 0,
        merchants: [...new Set(savedResults.map(r => r.merchant))],
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('❌ Erreur Google Shopping scraper:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      provider,
      response_time_ms: elapsed,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});