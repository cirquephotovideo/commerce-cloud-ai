import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { productName, maxResults = 5, testMode } = await req.json();

    if (testMode) {
      console.log('[SEARCH-IMAGES] Test mode - returning mock images');
      return new Response(
        JSON.stringify({ 
          images: [
            {
              url: 'https://via.placeholder.com/400x300/09f/fff?text=Test+Image+1',
              thumbnail: 'https://via.placeholder.com/150x150/09f/fff?text=Test+1',
              title: `Test Image 1 - ${productName}`,
              source: 'test.example.com',
              width: 400,
              height: 300
            },
            {
              url: 'https://via.placeholder.com/400x300/f90/fff?text=Test+Image+2',
              thumbnail: 'https://via.placeholder.com/150x150/f90/fff?text=Test+2',
              title: `Test Image 2 - ${productName}`,
              source: 'test.example.com',
              width: 400,
              height: 300
            }
          ], 
          source: 'test-mode',
          count: 2,
          testMode: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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
      console.log('[SEARCH-IMAGES] Google API not configured, returning empty results');
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
      const errorText = await response.text();
      console.error('[SEARCH-IMAGES] Google Search API error:', response.status, errorText);
      
      return new Response(
        JSON.stringify({ images: [], source: 'error', errorCode: response.status }),
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
    console.error('[SEARCH-IMAGES] Error in search-product-images:', error);
    return new Response(
      JSON.stringify({ 
        images: [], 
        source: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        http_status: 500
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
