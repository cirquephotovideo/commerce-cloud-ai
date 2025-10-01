import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const analysisPrompt = (productUrl: string) => `
Analyse complète du produit e-commerce à l'URL: ${productUrl}

Effectue une analyse détaillée avec les 9 dimensions suivantes:

1. **SEO**: Analyse du titre, meta description, mots-clés, structure URL
2. **Prix**: Évaluation de la stratégie tarifaire et positionnement marché
3. **Concurrence**: Identification des concurrents directs et leur positionnement
4. **Tendances**: Analyse des tendances actuelles du marché pour ce type de produit
5. **Description**: Suggestions d'amélioration du contenu et storytelling
6. **Optimisation Image**: Recommandations pour l'optimisation visuelle
7. **Tags & Catégories**: Suggestions de classification et taxonomie
8. **Avis Clients**: Analyse du sentiment et des retours clients (si disponibles)
9. **Rapport Global**: Score global et recommandations prioritaires

Fournis une analyse structurée, actionnable et basée sur les meilleures pratiques e-commerce actuelles.
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productUrl } = await req.json();
    console.log('Analyzing product:', productUrl);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling Lovable AI for product analysis...');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: 'Tu es un expert en analyse e-commerce avec une expertise en SEO, marketing digital, et stratégie produit.'
          },
          {
            role: 'user',
            content: analysisPrompt(productUrl)
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Analysis complete');
    
    const analysis = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ 
        success: true,
        productUrl,
        analysis,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in product-analyzer function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
