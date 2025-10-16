import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  productName?: string;
  query?: string;
  competitorSiteIds?: string[];
  maxResults?: number;
  testMode?: boolean;
}

interface SearchError {
  error: string;
  code: 'MISSING_PRODUCT_NAME' | 'NO_COMPETITOR_SITES' | 'AUTH_ERROR' | 'INTERNAL_ERROR';
  details?: any;
  hint?: string;
}

interface SearchResult {
  product_name: string;
  price: number;
  product_url: string;
  image_url?: string;
  stock_status?: string;
  rating?: number;
  reviews_count?: number;
  description?: string;
  source: 'google' | 'serper' | 'dual';
  confidence_score: number;
  search_metadata: {
    google_data?: any;
    serper_data?: any;
    response_time_ms?: number;
    is_promo?: boolean;
    discount_percent?: number;
    avg_price?: number;
    is_best_price?: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'Not authenticated',
        code: 'AUTH_ERROR'
      } as SearchError), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse and validate request body
    let requestBody: SearchRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('[DUAL-ENGINE] Invalid JSON:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        code: 'INTERNAL_ERROR'
      } as SearchError), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      productName: rawProductName,
      query,
      competitorSiteIds = [], 
      maxResults = 10 
    } = requestBody;

    // Support both productName and query
    const productName = (rawProductName || query || '').trim();

    if (!productName || typeof productName !== 'string') {
      console.error('[DUAL-ENGINE] Validation failed: productName or query is required');
      return new Response(JSON.stringify({ 
        error: 'productName or query is required and must be a non-empty string',
        code: 'MISSING_PRODUCT_NAME'
      } as SearchError), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[DUAL-ENGINE] Request validated:', { 
      productName, 
      siteCount: competitorSiteIds.length,
      maxResults,
      hasQuery: !!query,
      hasProductName: !!rawProductName,
      timestamp: new Date().toISOString()
    });
    
    // Mode test : retourner mock
    if (requestBody.testMode) {
      console.log('[DUAL-ENGINE] Test mode - skipping search API calls');
      return new Response(JSON.stringify({
        results: [
          {
            product_name: 'Test Product',
            price: 999.99,
            source: 'test-site',
            url: 'https://example.com/test',
            search_engine: 'test'
          }
        ],
        stats: {
          total_results: 1,
          google_results: 0,
          serper_results: 0,
          dual_results: 0,
          response_time_ms: 0
        },
        testMode: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_CX = Deno.env.get('GOOGLE_SEARCH_CX');
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');

    // Get competitor sites - if none provided, fetch all active ones
    let finalSiteIds = [...competitorSiteIds];
    
    if (finalSiteIds.length === 0) {
      console.log('[DUAL-ENGINE] No competitor sites, fetching all active sites');
      const { data: allSites } = await supabaseClient
        .from('competitor_sites')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(5);
      
      if (!allSites || allSites.length === 0) {
        return new Response(JSON.stringify({ 
          error: 'No competitor sites configured. Please add competitor sites first.',
          code: 'NO_COMPETITOR_SITES',
          hint: 'Go to /admin → Market Intelligence → Competitor Sites'
        } as SearchError), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      finalSiteIds = allSites.map(s => s.id);
    }

    const { data: sites } = await supabaseClient
      .from('competitor_sites')
      .select('*')
      .in('id', finalSiteIds)
      .eq('is_active', true);

    if (!sites || sites.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No active competitor sites found',
        code: 'NO_COMPETITOR_SITES'
      } as SearchError), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const allResults: SearchResult[] = [];
    const startTime = Date.now();

    // Search on each competitor site with BOTH engines in parallel
    for (const site of sites) {
      const searchQuery = `${productName} site:${site.site_url}`;
      console.log('[DUAL-ENGINE] Searching:', searchQuery);

      const searchPromises: Promise<any>[] = [];

      // Google Custom Search
      if (GOOGLE_API_KEY && GOOGLE_CX) {
        searchPromises.push(
          fetch(`https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(searchQuery)}`)
            .then(res => res.json())
            .then(data => ({ source: 'google', data }))
            .catch(err => {
              console.error('[DUAL-ENGINE] Google error:', err);
              return { source: 'google', data: null };
            })
        );
      }

      // Serper.dev Search
      if (SERPER_API_KEY) {
        searchPromises.push(
          fetch('https://google.serper.dev/shopping', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: searchQuery,
              gl: 'fr',
              hl: 'fr',
              num: 10,
            }),
          })
            .then(res => res.json())
            .then(data => ({ source: 'serper', data }))
            .catch(err => {
              console.error('[DUAL-ENGINE] Serper error:', err);
              return { source: 'serper', data: null };
            })
        );
      }

      // Wait for both searches to complete
      const results = await Promise.all(searchPromises);
      const responseTime = Date.now() - startTime;

      // Process results from both engines
      const googleResult = results.find(r => r.source === 'google');
      const serperResult = results.find(r => r.source === 'serper');

      // Merge and deduplicate results
      const mergedResults = mergeSearchResults(
        googleResult?.data,
        serperResult?.data,
        site,
        responseTime
      );

      allResults.push(...mergedResults);
    }

    // Detect promotions and best deals
    const resultsWithPromo = detectPromotions(allResults, user.id);

    // Save to database
    for (const result of resultsWithPromo) {
      await supabaseClient.from('price_monitoring').insert({
        user_id: user.id,
        product_name: result.product_name,
        current_price: result.price,
        product_url: result.product_url,
        image_url: result.image_url,
        stock_status: result.stock_status,
        rating: result.rating,
        reviews_count: result.reviews_count,
        description: result.description,
        search_engine: result.source,
        confidence_score: result.confidence_score,
        search_metadata: result.search_metadata,
        scraped_at: new Date().toISOString(),
      });
    }

    // Create alert if promotions detected
    const promoCount = resultsWithPromo.filter(r => r.search_metadata.is_promo).length;
    if (promoCount > 0) {
      await supabaseClient.from('user_alerts').insert({
        user_id: user.id,
        alert_type: 'price_drop',
        alert_data: {
          product_name: productName,
          promotion_count: promoCount,
          timestamp: new Date().toISOString(),
        },
        priority: 'high',
      });
    }

    console.log('[DUAL-ENGINE] Completed. Found:', allResults.length, 'results');

    return new Response(
      JSON.stringify({
        success: true,
        results: resultsWithPromo,
        stats: {
          total_results: allResults.length,
          google_results: allResults.filter(r => r.source === 'google' || r.source === 'dual').length,
          serper_results: allResults.filter(r => r.source === 'serper' || r.source === 'dual').length,
          dual_validated: allResults.filter(r => r.source === 'dual').length,
          promotions_found: promoCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[DUAL-ENGINE] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Determine appropriate status code
    let statusCode = 500;
    let errorCode: SearchError['code'] = 'INTERNAL_ERROR';

    const errorMessage = (error instanceof Error ? error.message : '').toLowerCase();
    if (errorMessage.includes('auth') || errorMessage.includes('token')) {
      statusCode = 401;
      errorCode = 'AUTH_ERROR';
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        code: errorCode
      } as SearchError),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mergeSearchResults(googleData: any, serperData: any, site: any, responseTime: number): SearchResult[] {
  const results: SearchResult[] = [];
  const urlMap = new Map<string, SearchResult>();

  // Process Google results
  if (googleData?.items) {
    for (const item of googleData.items) {
      const price = extractPrice(item.snippet || item.title);
      if (price) {
        urlMap.set(item.link, {
          product_name: item.title,
          price,
          product_url: item.link,
          image_url: item.pagemap?.cse_image?.[0]?.src,
          description: item.snippet,
          source: 'google',
          confidence_score: 0.7,
          search_metadata: {
            google_data: item,
            response_time_ms: responseTime,
          },
        });
      }
    }
  }

  // Process Serper results and cross-validate
  if (serperData?.shopping) {
    for (const item of serperData.shopping) {
      const existingResult = urlMap.get(item.link);
      
      if (existingResult) {
        // DUAL VALIDATION - Found by both engines!
        existingResult.source = 'dual';
        existingResult.confidence_score = 0.95;
        existingResult.search_metadata.serper_data = item;
        
        // Use better price if available
        if (item.price && item.price < existingResult.price) {
          existingResult.price = item.price;
        }
        
        // Enrich with Serper data
        existingResult.rating = item.rating;
        existingResult.reviews_count = item.reviews;
        existingResult.stock_status = item.delivery ? 'En stock' : 'Stock inconnu';
      } else {
        // Only found by Serper
        urlMap.set(item.link, {
          product_name: item.title,
          price: parseFloat(item.price?.replace(/[^0-9.]/g, '') || '0'),
          product_url: item.link,
          image_url: item.imageUrl,
          rating: item.rating,
          reviews_count: item.reviews,
          stock_status: item.delivery ? 'En stock' : 'Stock inconnu',
          source: 'serper',
          confidence_score: 0.8,
          search_metadata: {
            serper_data: item,
            response_time_ms: responseTime,
          },
        });
      }
    }
  }

  return Array.from(urlMap.values());
}

function extractPrice(text: string): number | null {
  const priceMatch = text.match(/(\d+[,.]?\d*)\s*€/);
  if (priceMatch) {
    return parseFloat(priceMatch[1].replace(',', '.'));
  }
  return null;
}

function detectPromotions(results: SearchResult[], userId: string): SearchResult[] {
  if (results.length === 0) return results;

  const prices = results.map(r => r.price).filter(p => p > 0);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);

  return results.map(result => {
    const drop = ((avgPrice - result.price) / avgPrice) * 100;
    const isPromo = drop > 10 || result.price === minPrice;

    result.search_metadata.is_promo = isPromo;
    result.search_metadata.discount_percent = drop;
    result.search_metadata.avg_price = avgPrice;
    result.search_metadata.is_best_price = result.price === minPrice;

    return result;
  });
}
