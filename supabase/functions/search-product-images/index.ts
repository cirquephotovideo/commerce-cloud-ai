import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageResult {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  width?: number;
  height?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, maxResults = 5 } = await req.json();
    
    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'Product name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching images for: ${productName}`);

    // Use Google Custom Search API for image search
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_CX = Deno.env.get('GOOGLE_SEARCH_CX');

    if (!GOOGLE_API_KEY || !GOOGLE_CX) {
      console.log('Google Search API not configured, returning empty results');
      return new Response(
        JSON.stringify({ images: [], source: 'none' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search for product images using Google Custom Search
    // Prioritize official sources: Amazon, manufacturer sites, official retailers
    const searchQuery = encodeURIComponent(`${productName} official product image`);
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${searchQuery}&searchType=image&num=${Math.min(maxResults * 2, 10)}&imgSize=large&imgType=photo&safe=active`;

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('Google Search API error:', response.status, await response.text());
      return new Response(
        JSON.stringify({ images: [], source: 'error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Liste des domaines officiels fiables
    const trustedDomains = [
      'amazon.com', 'amazon.fr', 'amazon.co.uk', 'amazon.de', 'amazon.es', 'amazon.it',
      'apple.com', 'samsung.com', 'sony.com', 'lg.com', 'dell.com', 'hp.com',
      'nike.com', 'adidas.com', 'microsoft.com', 'lenovo.com', 'asus.com',
      'cdiscount.com', 'fnac.com', 'darty.com', 'boulanger.com',
      'decathlon.com', 'leroy-merlin.fr', 'castorama.fr',
      'carrefour.fr', 'auchan.fr', 'leclerc.fr'
    ];
    
    // Filtrer et scorer les images selon leur source
    const scoredImages = (data.items || []).map((item: any) => {
      const source = item.displayLink?.toLowerCase() || '';
      let score = 0;
      
      // Priorité maximale pour les domaines de confiance
      const isTrusted = trustedDomains.some(domain => source.includes(domain));
      if (isTrusted) {
        score += 100;
        
        // Bonus pour Amazon (source très fiable pour images produits)
        if (source.includes('amazon')) {
          score += 50;
        }
      }
      
      // Bonus pour les URLs contenant "product", "official", ou le nom de la marque
      if (item.link?.toLowerCase().includes('product')) score += 20;
      if (item.link?.toLowerCase().includes('official')) score += 20;
      if (item.title?.toLowerCase().includes('official')) score += 15;
      
      // Malus pour les sites suspects
      const suspiciousDomains = ['pinterest', 'ebay', 'aliexpress', 'wish', 'temu'];
      if (suspiciousDomains.some(domain => source.includes(domain))) {
        score -= 100;
      }
      
      return {
        url: item.link,
        thumbnail: item.image?.thumbnailLink || item.link,
        title: item.title || '',
        source: item.displayLink || '',
        width: item.image?.width,
        height: item.image?.height,
        score,
        isTrusted
      };
    })
    .filter((img: any) => img.score > 0) // Exclure les images avec score négatif
    .sort((a: any, b: any) => b.score - a.score) // Trier par score
    .slice(0, maxResults); // Limiter au nombre demandé
    
    const images: ImageResult[] = scoredImages.map(({ url, thumbnail, title, source, width, height }: any) => ({
      url,
      thumbnail,
      title,
      source,
      width,
      height
    }));

    console.log(`Found ${images.length} official images for ${productName} (${scoredImages.filter((img: any) => img.isTrusted).length} from trusted sources)`);

    return new Response(
      JSON.stringify({ images, source: 'google', count: images.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-product-images:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', images: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
