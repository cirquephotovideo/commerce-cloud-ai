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
    const searchQuery = encodeURIComponent(`${productName} product high quality`);
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${searchQuery}&searchType=image&num=${maxResults}&imgSize=large&imgType=photo`;

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('Google Search API error:', response.status, await response.text());
      return new Response(
        JSON.stringify({ images: [], source: 'error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    const images: ImageResult[] = (data.items || []).map((item: any) => ({
      url: item.link,
      thumbnail: item.image?.thumbnailLink || item.link,
      title: item.title || '',
      source: item.displayLink || '',
      width: item.image?.width,
      height: item.image?.height,
    }));

    console.log(`Found ${images.length} images for ${productName}`);

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
