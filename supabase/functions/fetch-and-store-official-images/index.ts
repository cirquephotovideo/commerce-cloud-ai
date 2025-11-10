import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callAIWithFallback } from '../_shared/ai-fallback.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageSource {
  url: string;
  source: 'direct_scraping' | 'ollama_web_search' | 'amazon' | 'google_shopping';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, brand, productUrl, ean, asin, analysisId } = await req.json();

    if (!productName || !analysisId) {
      return new Response(
        JSON.stringify({ error: 'productName and analysisId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FETCH-IMAGES] Starting image fetch for: ${productName}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const foundImages: ImageSource[] = [];

    // SOURCE 1: Direct scraping (if URL provided)
    if (productUrl && foundImages.length < 3) {
      console.log('[FETCH-IMAGES] Trying direct scraping...');
      try {
        const scraped = await scrapeProductPage(productUrl);
        scraped.forEach(url => foundImages.push({ url, source: 'direct_scraping' }));
        console.log(`[FETCH-IMAGES] Found ${scraped.length} images via scraping`);
      } catch (error) {
        console.error('[FETCH-IMAGES] Scraping error:', error);
      }
    }

    // SOURCE 2: Ollama Web Search (NEW - PRIORITY)
    if (foundImages.length < 3) {
      console.log('[FETCH-IMAGES] Trying Ollama web search...');
      try {
        const ollamaImages = await searchWithOllamaWeb(productName, brand);
        ollamaImages.forEach(url => foundImages.push({ url, source: 'ollama_web_search' }));
        console.log(`[FETCH-IMAGES] Found ${ollamaImages.length} images via Ollama`);
      } catch (error) {
        console.error('[FETCH-IMAGES] Ollama search error:', error);
      }
    }

    // SOURCE 3: Amazon (if EAN or ASIN available)
    if (foundImages.length < 3 && (ean || asin)) {
      console.log('[FETCH-IMAGES] Trying Amazon...');
      try {
        const amazonImages = await fetchAmazonImages(supabase, ean, asin);
        amazonImages.forEach(url => foundImages.push({ url, source: 'amazon' }));
        console.log(`[FETCH-IMAGES] Found ${amazonImages.length} images via Amazon`);
      } catch (error) {
        console.error('[FETCH-IMAGES] Amazon error:', error);
      }
    }

    // SOURCE 4: Google Shopping (fallback)
    if (foundImages.length < 3) {
      console.log('[FETCH-IMAGES] Trying Google Shopping...');
      try {
        const googleImages = await fetchGoogleShoppingImages(supabase, productName);
        googleImages.forEach(url => foundImages.push({ url, source: 'google_shopping' }));
        console.log(`[FETCH-IMAGES] Found ${googleImages.length} images via Google Shopping`);
      } catch (error) {
        console.error('[FETCH-IMAGES] Google Shopping error:', error);
      }
    }

    // Validate URLs before downloading
    console.log(`[FETCH-IMAGES] Validating ${foundImages.length} URLs...`);
    const validatedImages: ImageSource[] = [];
    
    for (const imageSource of foundImages) {
      if (validatedImages.length >= 10) break;
      
      if (await validateImageUrl(imageSource.url)) {
        validatedImages.push(imageSource);
      }
    }
    
    console.log(`[FETCH-IMAGES] ${validatedImages.length}/${foundImages.length} URLs validated`);

    // Download and store validated images
    const storedImages: { url: string; source: string }[] = [];
    const sources = new Set<string>();

    for (let i = 0; i < validatedImages.length; i++) {
      const imageSource = validatedImages[i];
      const storedUrl = await downloadAndStoreImage(
        supabase,
        imageSource.url,
        analysisId,
        i
      );
      
      if (storedUrl) {
        storedImages.push({ url: storedUrl, source: imageSource.source });
        sources.add(imageSource.source);
      }
    }

    // Fallback to placeholder if no images stored
    if (storedImages.length === 0) {
      console.log('[FETCH-IMAGES] ⚠️ No valid images, using placeholder');
      const placeholderUrl = `https://placehold.co/800x800/e2e8f0/1e293b?text=${encodeURIComponent(productName || 'Product')}`;
      storedImages.push({ url: placeholderUrl, source: 'placeholder' });
      sources.add('placeholder');
    }

    console.log(`[FETCH-IMAGES] ✅ Successfully stored ${storedImages.length} images from: ${Array.from(sources).join(', ')}`);

    return new Response(
      JSON.stringify({
        images: storedImages.map(img => img.url),
        sources: Array.from(sources),
        count: storedImages.length,
        details: storedImages
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[FETCH-IMAGES] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        images: [],
        sources: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Validate image URL before download
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });
    
    const contentType = response.headers.get('content-type');
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    const isValid = (
      response.ok &&
      contentType?.startsWith('image/') &&
      contentLength > 5000 // Au moins 5KB
    );
    
    if (!isValid) {
      console.log(`[VALIDATE] ❌ ${url.slice(0, 80)}: type=${contentType}, size=${contentLength}`);
    }
    
    return isValid;
  } catch (error) {
    console.error(`[VALIDATE] ❌ ${url.slice(0, 80)}:`, error.message);
    return false;
  }
}

// Scrape product page for images
async function scrapeProductPage(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) return [];

    const html = await response.text();
    const images: string[] = [];

    // Extract JSON-LD schema.org images
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
    for (const match of jsonLdMatches) {
      try {
        const jsonData = JSON.parse(match[1]);
        if (jsonData['@type'] === 'Product' && jsonData.image) {
          const imageUrls = Array.isArray(jsonData.image) ? jsonData.image : [jsonData.image];
          images.push(...imageUrls.filter((url: string) => url.startsWith('http')));
        }
      } catch {}
    }

    // Extract Open Graph images
    const ogMatches = html.matchAll(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi);
    for (const match of ogMatches) {
      if (match[1] && match[1].startsWith('http')) {
        images.push(match[1]);
      }
    }

    // Extract high-res images from common patterns
    const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      const src = match[1];
      if (src && src.startsWith('http') && (
        src.includes('product') || 
        src.includes('item') || 
        src.includes('image') ||
        src.match(/\d{3,4}x\d{3,4}/) // Size indicators
      )) {
        images.push(src);
      }
    }

    return [...new Set(images)].slice(0, 5);
  } catch (error) {
    console.error('[SCRAPE] Error:', error);
    return [];
  }
}

// Search with Ollama Web Search
async function searchWithOllamaWeb(productName: string, brand?: string): Promise<string[]> {
  try {
    const searchQuery = brand 
      ? `${productName} ${brand} official product images high resolution`
      : `${productName} official product images high resolution`;

    const prompt = `Find OFFICIAL high-resolution product images for: ${searchQuery}

CRITICAL REQUIREMENTS:
1. URLs must be LIVE and ACCESSIBLE (no broken links)
2. Image resolution: minimum 800x800px
3. File formats: JPG, PNG, WebP
4. Sources priority:
   - Official manufacturer website
   - Amazon product pages  
   - Major e-commerce sites (Fnac, Darty, Boulanger)

EXCLUDE:
- Thumbnails or low-res images (<800px)
- Watermarked images
- Pinterest/Google Images cache URLs
- Social media images

Return ONLY a JSON array of TESTED, working URLs:
{"images": ["https://url1.jpg", "https://url2.jpg"]}`;

    const result = await callAIWithFallback({
      messages: [{ role: 'user', content: prompt }],
      web_search: true,
      model: 'llama3-70b-8192',
      max_tokens: 1000
    }, []);

    if (!result.success || !result.content) {
      console.log('[OLLAMA-WEB] No results from AI');
      return [];
    }

    // Parse JSON response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const images = parsed.images || [];
    
    return images
      .filter((url: string) => url.startsWith('http'))
      .slice(0, 5);

  } catch (error) {
    console.error('[OLLAMA-WEB] Error:', error);
    return [];
  }
}

// Fetch Amazon images
async function fetchAmazonImages(supabase: any, ean?: string, asin?: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke('amazon-product-search', {
      body: { query: ean || asin, searchType: asin ? 'asin' : 'ean' }
    });

    if (error || !data?.products?.[0]?.images) return [];

    return data.products[0].images.slice(0, 5);
  } catch (error) {
    console.error('[AMAZON] Error:', error);
    return [];
  }
}

// Fetch Google Shopping images
async function fetchGoogleShoppingImages(supabase: any, productName: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke('google-shopping-scraper', {
      body: { query: productName, maxResults: 5 }
    });

    if (error || !data?.products) return [];

    return data.products
      .map((p: any) => p.thumbnail)
      .filter((url: string) => url && url.startsWith('http'))
      .slice(0, 5);
  } catch (error) {
    console.error('[GOOGLE-SHOPPING] Error:', error);
    return [];
  }
}

// Download and store image in Supabase Storage
async function downloadAndStoreImage(
  supabase: any,
  imageUrl: string,
  analysisId: string,
  index: number
): Promise<string | null> {
  try {
    // Download image
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!response.ok) {
      console.log(`[DOWNLOAD] Failed to fetch ${imageUrl}: ${response.status}`);
      return null;
    }

    // Verify content type
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      console.log(`[DOWNLOAD] Invalid content type: ${contentType}`);
      return null;
    }

    // Get image data
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Uint8Array(arrayBuffer);

    // Generate filename
    const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
    const filename = `${analysisId}/${Date.now()}_${index}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filename, blob, {
        contentType,
        cacheControl: '31536000', // 1 year
        upsert: false
      });

    if (uploadError) {
      console.error('[UPLOAD] Error:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filename);

    return urlData.publicUrl;

  } catch (error) {
    console.error('[DOWNLOAD-STORE] Error:', error);
    return null;
  }
}
