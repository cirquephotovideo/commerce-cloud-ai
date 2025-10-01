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
    const { productUrl, analysisTypes } = await req.json();
    
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Non authentifié");

    console.log('Analyses demandées:', analysisTypes);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurée");

    const GOOGLE_SEARCH_API_KEY = Deno.env.get('GOOGLE_SEARCH_API_KEY');
    const GOOGLE_SEARCH_CX = Deno.env.get('GOOGLE_SEARCH_CX');

    const results: any = {};

    // Technical Analysis
    if (analysisTypes.includes('technical')) {
      const technicalPrompt = `Analyse technique approfondie du produit: ${productUrl}
      
      Fournis:
      1. Compatibilité: Liste les produits compatibles/incompatibles, accessoires requis
      2. Spécifications: Analyse détaillée des specs techniques
      3. Obsolescence: Score (0-1) et stade de cycle de vie (new/mature/declining/obsolete)
      4. Restrictions régionales: Voltage, normes, limitations géographiques
      
      Format JSON strict:
      {
        "compatibility": { "compatible": [], "incompatible": [], "required_accessories": [], "regional_restrictions": {} },
        "specs": { "key_specs": {}, "technical_details": {} },
        "obsolescence_score": 0.0,
        "lifecycle_stage": "mature"
      }`;

      const techResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: technicalPrompt }],
        }),
      });

      const techData = await techResponse.json();
      results.technical = JSON.parse(techData.choices[0].message.content);
    }

    // Commercial Optimization
    if (analysisTypes.includes('commercial')) {
      const commercialPrompt = `Optimisation commerciale pour: ${productUrl}
      
      Calcule:
      1. Marge dynamique recommandée (min/max)
      2. Suggestions de bundles rentables
      3. Prédiction de taux de retours (0-1)
      4. Estimation coûts SAV
      
      Format JSON:
      {
        "margin": { "min": 0, "max": 0, "recommended": 0 },
        "bundles": [{ "products": [], "perceived_value": 0, "profit_margin": 0 }],
        "return_prediction": { "rate": 0.0, "main_causes": [], "sav_cost_estimate": 0 }
      }`;

      const commResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: commercialPrompt }],
        }),
      });

      const commData = await commResponse.json();
      results.commercial = JSON.parse(commData.choices[0].message.content);
    }

    // Market Intelligence with Web Search
    if (analysisTypes.includes('market') && GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_CX) {
      const searchQuery = `${productUrl} prix concurrents`;
      const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(searchQuery)}`;
      
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      const marketPrompt = `Analyse de marché basée sur ces données: ${JSON.stringify(searchData.items?.slice(0, 5) || [])}
      
      Fournis:
      1. Prix concurrents détectés
      2. Alertes promotions
      3. Saisonnalité prédite
      
      Format JSON:
      {
        "competitor_prices": [{ "site": "", "price": 0, "url": "" }],
        "promotion_alerts": [],
        "seasonality": { "peak_periods": [], "low_periods": [] }
      }`;

      const marketResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: marketPrompt }],
        }),
      });

      const marketData = await marketResponse.json();
      results.market = JSON.parse(marketData.choices[0].message.content);
    }

    // Risk Assessment
    if (analysisTypes.includes('risk')) {
      const riskPrompt = `Évaluation des risques pour: ${productUrl}
      
      Évalue:
      1. Conformité (CE, RoHS, DEEE) - status de chaque norme
      2. Analyse garantie - coûts, recommandations
      3. Score d'authenticité (0-1)
      4. Niveau de risque global (low/medium/high)
      
      Format JSON:
      {
        "compliance_status": { "CE": "", "RoHS": "", "DEEE": "" },
        "warranty_analysis": { "cost_estimate": 0, "recommendations": [] },
        "authenticity_score": 0.0,
        "risk_level": "low"
      }`;

      const riskResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: riskPrompt }],
        }),
      });

      const riskData = await riskResponse.json();
      results.risk = JSON.parse(riskData.choices[0].message.content);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erreur analyse avancée:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});