import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supplier_product_id } = await req.json();
    
    if (!supplier_product_id) {
      throw new Error("supplier_product_id est requis");
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[enrich-web] Début enrichissement pour produit: ${supplier_product_id}`);

    // 1. Fetch produit
    const { data: product, error: productError } = await supabase
      .from('supplier_products')
      .select('*')
      .eq('id', supplier_product_id)
      .single();

    if (productError) {
      console.error('[enrich-web] Erreur fetch produit:', productError);
      throw productError;
    }

    console.log(`[enrich-web] Produit: ${product.product_name}`);

    // 2. Web search via Serper
    const searchQuery = `${product.product_name} ${product.additional_data?.brand || ''} specifications`;
    console.log(`[enrich-web] Recherche web: ${searchQuery}`);

    const serperApiKey = Deno.env.get('SERPER_API_KEY');
    if (!serperApiKey) {
      console.warn('[enrich-web] SERPER_API_KEY non configurée, enrichissement sans web search');
    }

    let webResults = 'Aucun résultat de recherche web disponible.';
    
    if (serperApiKey) {
      try {
        const serperResponse = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': serperApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: searchQuery,
            num: 5
          })
        });

        if (serperResponse.ok) {
          const serperData = await serperResponse.json();
          webResults = serperData.organic?.slice(0, 5).map((r: any) => 
            `${r.title}\n${r.snippet}`
          ).join('\n\n') || 'Aucun résultat trouvé';
          console.log('[enrich-web] Web search réussie');
        } else {
          console.warn('[enrich-web] Serper API erreur:', serperResponse.status);
        }
      } catch (error) {
        console.error('[enrich-web] Erreur Serper API:', error);
      }
    }

    // 3. Ollama enrichment via ollama-proxy
    const prompt = `Tu es un expert en catalogage produit. Voici un produit fournisseur :
- Nom : ${product.product_name}
- Marque : ${product.additional_data?.brand || 'Inconnue'}
- Référence : ${product.supplier_reference}
- Prix : ${product.purchase_price} EUR

Résultats de recherche web :
${webResults}

Génère une fiche produit structurée avec :
1. Description marketing (100-150 mots, professionnelle et engageante)
2. Spécifications techniques (5-10 points clés, bullet points)
3. Cas d'usage principaux (3-5 scénarios concrets)
4. Points forts du produit (3-5 avantages)

Réponds UNIQUEMENT avec un JSON valide suivant ce format exact :
{
  "description": "...",
  "specs": ["spec1", "spec2", ...],
  "use_cases": ["use_case1", "use_case2", ...],
  "highlights": ["highlight1", "highlight2", ...]
}

Important : Ne génère QUE du JSON valide, sans texte avant ou après.`;

    console.log('[enrich-web] Appel Ollama Cloud...');

    const ollamaResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ollama-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'chat',
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Tu es un assistant qui répond UNIQUEMENT en JSON valide.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama proxy erreur: ${ollamaResponse.status}`);
    }

    const ollamaData = await ollamaResponse.json();
    console.log('[enrich-web] Réponse Ollama reçue');

    let enrichedData: any = {};
    try {
      // Extraire le JSON de la réponse
      const responseText = ollamaData.response || '{}';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        enrichedData = JSON.parse(jsonMatch[0]);
      } else {
        enrichedData = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('[enrich-web] Erreur parsing JSON Ollama:', parseError);
      console.log('[enrich-web] Réponse brute:', ollamaData.response);
      // Fallback avec description simple
      enrichedData = {
        description: `${product.product_name} - ${product.additional_data?.brand || ''}`,
        specs: [],
        use_cases: [],
        highlights: []
      };
    }

    console.log('[enrich-web] Données enrichies:', enrichedData);

    // 4. Update product
    const { error: updateError } = await supabase
      .from('supplier_products')
      .update({
        description: enrichedData.description,
        additional_data: {
          ...product.additional_data,
          specs: enrichedData.specs || [],
          use_cases: enrichedData.use_cases || [],
          highlights: enrichedData.highlights || [],
          web_enriched_at: new Date().toISOString()
        }
      })
      .eq('id', supplier_product_id);

    if (updateError) {
      console.error('[enrich-web] Erreur update:', updateError);
      throw updateError;
    }

    console.log('[enrich-web] Enrichissement terminé avec succès');

    return new Response(
      JSON.stringify({ 
        success: true, 
        enrichedData,
        product_name: product.product_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[enrich-web] Erreur globale:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
