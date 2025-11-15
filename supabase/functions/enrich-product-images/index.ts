import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callOllamaWithWebSearch } from "../_shared/ollama-client.ts";
import { parseJSONFromText } from "../_shared/json-parser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisId, productData } = await req.json();
    console.log('[IMAGES] Starting enrichment for:', analysisId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const startTime = Date.now();
    
    const prompt = `Tu es un expert en recherche d'images produits e-commerce. 

PRODUIT À RECHERCHER:
- Nom: ${productData?.name || 'N/A'}
- Marque: ${productData?.brand || 'N/A'}
- EAN: ${productData?.ean || 'N/A'}
- Catégorie: ${productData?.category || 'N/A'}

INSTRUCTIONS STRICTES:
1. Recherche au minimum 8-12 images de HAUTE QUALITÉ du produit exact
2. Privilégie UNIQUEMENT les sources fiables:
   - Sites officiels des fabricants (${productData?.brand || 'marque'}.com)
   - Retailers majeurs: Amazon.com, Amazon.fr, Fnac.com, Darty.com, Cdiscount.com
   - Distributeurs spécialisés B2B
3. URLs DIRECTES vers les images (format: .jpg, .png, .webp) - PAS de pages web
4. Évite les miniatures - privilégie les résolutions 800px minimum
5. Vérifie que les URLs sont complètes et accessibles (https://)

EXEMPLES DE BONNES URLS:
- https://m.media-amazon.com/images/I/71ABC123DEF._SL1500_.jpg
- https://www.${productData?.brand || 'brand'}.com/media/catalog/product/x/y/xyz.jpg

RÉPONSE ATTENDUE (JSON uniquement):
{
  "image_urls": [
    "https://exemple.com/image1.jpg",
    "https://exemple.com/image2.jpg"
  ],
  "image_sources": ["amazon.com", "site-officiel.com"]
}

Retourne UNIQUEMENT le JSON, sans texte supplémentaire.`;

    console.log('[IMAGES] 🤖 Calling AI with web search...');
    
    const aiResponse = await callOllamaWithWebSearch({
      model: 'gpt-oss:120b-cloud',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      maxTokens: 2000
    });

    const aiDuration = Date.now() - startTime;
    console.log(`[IMAGES] ✅ AI response received in ${aiDuration}ms`);

    console.log('[IMAGES] 🔍 Parsing JSON response...');
    const imageData = parseJSONFromText(aiResponse.content);

    // Validation stricte des URLs avec HEAD requests
    const validationStart = Date.now();
    const potentialUrls = Array.isArray(imageData.image_urls) ? imageData.image_urls : [];
    console.log(`[IMAGES] 🔍 Validating ${potentialUrls.length} URLs...`);
    
    const validUrls: string[] = [];
    
    for (const url of potentialUrls) {
      try {
        new URL(url);
        if (!url.startsWith('http')) continue;
        
        // HEAD request pour vérifier que l'image existe
        const headResponse = await fetch(url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        
        const contentType = headResponse.headers.get('content-type') || '';
        const isImage = contentType.startsWith('image/');
        
        if (headResponse.ok && isImage) {
          validUrls.push(url);
          console.log(`[IMAGES] ✅ Valid: ${url.substring(0, 60)}...`);
        } else {
          console.log(`[IMAGES] ❌ Invalid (status=${headResponse.status}, type=${contentType}): ${url.substring(0, 60)}...`);
        }
      } catch (error) {
        console.log(`[IMAGES] ❌ Failed to validate: ${url.substring(0, 60)}...`, error instanceof Error ? error.message : '');
      }
    }
    
    const validationDuration = Date.now() - validationStart;
    console.log(`[IMAGES] 🔍 Validation completed in ${validationDuration}ms: ${validUrls.length}/${potentialUrls.length} valid`);

    // Si moins de 3 images valides, second appel AI avec prompt alternatif
    if (validUrls.length < 3) {
      console.log('[IMAGES] ⚠️ Insufficient valid images, trying alternative search...');
      
      const alternativePrompt = `Trouve des images pour ce produit en cherchant sur des sites marchands spécifiques:

PRODUIT: ${productData?.name || 'N/A'}
MARQUE: ${productData?.brand || 'N/A'}

RECHERCHE SUR CES SITES:
1. Amazon.fr/Amazon.com - Cherche le produit par nom exact
2. Fnac.com - Section high-tech/informatique
3. Cdiscount.com - Marketplace français
4. Site officiel de ${productData?.brand || 'la marque'}

IMPORTANT: Fournis UNIQUEMENT des URLs d'images directes (finissant par .jpg, .png, .webp)

Format JSON uniquement:
{
  "image_urls": ["url1", "url2", "url3"]
}`;

      try {
        const altResponse = await callOllamaWithWebSearch({
          model: 'gpt-oss:120b-cloud',
          messages: [{ role: 'user', content: alternativePrompt }],
          temperature: 0.5,
          maxTokens: 1500
        });
        
        const altData = parseJSONFromText(altResponse.content);
        const altUrls = Array.isArray(altData.image_urls) ? altData.image_urls : [];
        
        console.log(`[IMAGES] 🔄 Alternative search found ${altUrls.length} URLs, validating...`);
        
        for (const url of altUrls) {
          if (validUrls.length >= 8) break; // Max 8 images total
          
          try {
            new URL(url);
            if (!url.startsWith('http')) continue;
            
            const headResponse = await fetch(url, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(5000)
            });
            
            const contentType = headResponse.headers.get('content-type') || '';
            if (headResponse.ok && contentType.startsWith('image/')) {
              validUrls.push(url);
              console.log(`[IMAGES] ✅ Alternative valid: ${url.substring(0, 60)}...`);
            }
          } catch {}
        }
      } catch (error) {
        console.log('[IMAGES] ⚠️ Alternative search failed:', error instanceof Error ? error.message : '');
      }
    }

    const normalizedData = {
      image_urls: validUrls,
      image_sources: Array.isArray(imageData.image_sources) ? imageData.image_sources : []
    };

    const totalDuration = Date.now() - startTime;
    console.log(`[IMAGES] ✅ Process completed in ${totalDuration}ms: ${validUrls.length} valid images`);
    console.log(`[IMAGES] 💾 Saving: ${JSON.stringify(validUrls.slice(0, 2))}...`);

    // Mettre à jour product_analyses avec les nouvelles images
    const { data: currentAnalysis } = await supabase
      .from('product_analyses')
      .select('image_urls')
      .eq('id', analysisId)
      .single();

    const existingUrls = currentAnalysis?.image_urls || [];
    const mergedUrls = [...new Set([...existingUrls, ...validUrls])]; // Dédupliquer

    const { error: updateError } = await supabase
      .from('product_analyses')
      .update({
        image_urls: mergedUrls,
        updated_at: new Date().toISOString()
      })
      .eq('id', analysisId);

    if (updateError) {
      throw updateError;
    }

    console.log('[IMAGES] ✅ Image enrichment completed');

    return new Response(
      JSON.stringify({ 
        success: true,
        data: {
          ...normalizedData,
          total_images: mergedUrls.length
        },
        provider: 'ollama'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[IMAGES] ❌ Error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
