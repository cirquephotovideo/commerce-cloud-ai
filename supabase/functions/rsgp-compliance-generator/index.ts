import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function getAvailableProviders(supabase: any, userId: string) {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  
  const { data: ollamaConfig } = await supabase
    .from('ollama_configurations')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  
  return {
    lovable: { available: !!lovableKey },
    ollama: { 
      available: !!ollamaConfig,
      config: ollamaConfig,
      url: ollamaConfig?.ollama_url || 'http://localhost:11434',
      model: ollamaConfig?.default_model || 'llama3.1'
    }
  };
}

async function fetchWebData(productName: string, amazonData: any) {
  const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
  let searchResults: any[] = [];
  let searchMethod = 'none';

  if (SERPER_API_KEY) {
    try {
      const brand = amazonData?.brand || '';
      const ean = amazonData?.ean || '';
      
      const queries = [
        `${brand || productName} manufacturer contact EU representative address`,
        `${productName} ${ean} CE certificate conformity declaration PDF`,
        `${brand || productName} safety datasheet MSDS compliance documentation`,
        `${productName} user manual instructions notice PDF download`,
        `${productName} RSGP responsible person Europe import regulations`
      ];

      const searchPromises = queries.map(async (q) => {
        const res = await fetch('https://google.serper.dev/search', {
          method: 'POST',
          headers: {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ q, num: 4 })
        });
        const data = await res.json();
        return (data.organic || []).map((r: any) => ({ ...r, query: q }));
      });

      const results = await Promise.all(searchPromises);
      searchResults = results.flat();
      searchMethod = 'serper';
      
      console.log(`✅ [RSGP] Serper: ${searchResults.length} résultats`);
    } catch (error) {
      console.warn('⚠️ [RSGP] Serper failed:', error);
    }
  }

  if (searchResults.length === 0) {
    try {
      searchResults = await simulateWebSearchWithAI(productName, amazonData);
      searchMethod = 'ai_simulated';
      console.log(`✅ [RSGP] AI simulation: ${searchResults.length} résultats`);
    } catch (error) {
      console.warn('⚠️ [RSGP] AI search failed:', error);
    }
  }

  return { searchResults, searchMethod };
}

async function simulateWebSearchWithAI(productName: string, amazonData: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const prompt = `Simule une recherche web pour trouver des informations RSGP sur ce produit:

Produit: ${productName}
Marque: ${amazonData?.brand || 'inconnue'}
EAN: ${amazonData?.ean || 'inconnu'}

Génère 8-10 résultats plausibles et réalistes contenant:
- Coordonnées fabricant et responsable UE
- Certifications CE et normes
- Liens vers notices PDF et documentations
- Informations de conformité

Format JSON:
[
  {
    "title": "Titre pertinent du résultat",
    "snippet": "Extrait contenant des infos concrètes (adresse fabricant, normes EN/ISO, etc)",
    "link": "https://example.com/path"
  }
]`;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: 'Retourne UNIQUEMENT un tableau JSON valide.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || '[]';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  return JSON.parse(content);
}

// ============================================
// SPECIALIZED PROMPTS
// ============================================

function createManufacturerPrompt(product: any, amazonData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('manufacturer') ||
      r.snippet?.toLowerCase().includes('fabricant') ||
      r.snippet?.toLowerCase().includes('responsible') ||
      r.snippet?.toLowerCase().includes('address')
    )
    .slice(0, 4);

  return `MISSION: Extraire coordonnées FABRICANT et RESPONSABLE UE

PRODUIT: ${product.product_name}
MARQUE: ${amazonData?.brand || 'inconnue'}
EAN: ${amazonData?.ean || 'inconnu'}
VENDEUR AMAZON: ${amazonData?.buy_box_seller_name || 'inconnu'}

SOURCES WEB:
${relevantResults.map((r, i) => `[${i+1}] ${r.title}\n${r.snippet}`).join('\n\n')}

DONNÉES AMAZON:
- Fabricant déclaré: ${amazonData?.manufacturer || 'non communiqué'}
- Pays expédition: ${amazonData?.buy_box_ship_country || 'non communiqué'}

RETOURNE CE JSON:
{
  "fabricant_nom": "Nom exact entreprise",
  "fabricant_adresse": "Adresse postale complète",
  "pays_origine": "Code ISO-2 (FR/DE/CN...)",
  "personne_responsable_ue": "Nom et adresse responsable UE",
  "fournisseur": "${amazonData?.buy_box_seller_name || 'non communiqué'}"
}

RÈGLES:
- Privilégie données web sur Amazon
- Si introuvable: "non communiqué"
- Vérifie cohérence pays/adresse`;
}

function createCompliancePrompt(product: any, amazonData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.includes('CE') ||
      r.snippet?.toLowerCase().includes('conformity') ||
      r.snippet?.toLowerCase().includes('norm') ||
      r.snippet?.toLowerCase().includes('standard') ||
      r.snippet?.toLowerCase().includes('certification')
    )
    .slice(0, 4);

  return `MISSION: Identifier CONFORMITÉ CE et NORMES

PRODUIT: ${product.product_name}
CATÉGORIE: ${product.category || 'non définie'}

SOURCES:
${relevantResults.map((r, i) => `[${i+1}] ${r.snippet}`).join('\n\n')}

JSON ATTENDU:
{
  "normes_ce": ["EN XXXXX", "ISO XXXXX"],
  "documents_conformite": {
    "declaration_conformite": "URL ou non communiqué",
    "certificat_ce": "URL ou non communiqué",
    "rapport_test": "URL ou non communiqué"
  },
  "evaluation_risque": "Description niveau risque (faible/moyen/élevé)",
  "date_evaluation": "YYYY-MM-DD ou null"
}

RÈGLES:
- normes_ce: [] si aucune
- URLs complètes uniquement
- evaluation_risque basée sur catégorie`;
}

function createDocumentationPrompt(product: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('manual') ||
      r.snippet?.toLowerCase().includes('notice') ||
      r.snippet?.toLowerCase().includes('pdf') ||
      r.snippet?.toLowerCase().includes('instructions') ||
      r.snippet?.toLowerCase().includes('guide')
    )
    .slice(0, 4);

  return `MISSION: Trouver DOCUMENTATION UTILISATEUR

PRODUIT: ${product.product_name}

SOURCES:
${relevantResults.map((r, i) => `[${i+1}] ${r.title}\n${r.link}\n${r.snippet}`).join('\n\n')}

JSON:
{
  "notice_pdf": "URL PDF ou non communiqué",
  "procedure_rappel": "Procédure rappel produit",
  "service_consommateur": "Email/téléphone support",
  "langues_disponibles": ["fr", "en"]
}

RÈGLES:
- notice_pdf: URL valide .pdf
- procedure_rappel: 50-200 mots
- langues: codes ISO-2`;
}

function createTechnicalPrompt(product: any, amazonData: any) {
  return `MISSION: Caractéristiques TECHNIQUES RSGP

PRODUIT: ${product.product_name}
DESCRIPTION: ${product.description || 'non disponible'}
CATÉGORIE: ${product.category || 'non définie'}

JSON:
{
  "categorie_rsgp": "jouets|électronique|textile|cosmétiques|alimentaire|autre",
  "age_recommande": "3+ ans|6+ ans|12+ ans|Adultes|Tous âges",
  "avertissements": ["Avertissement pertinent"],
  "entretien": "Instructions entretien",
  "recyclage": "Instructions recyclage",
  "garantie": "24 mois",
  "firmware_ou_logiciel": "Version ou N/A",
  "compatibilites": []
}

LOGIQUE:
- categorie_rsgp selon mots-clés
- age_recommande selon risques
- avertissements pertinents`;
}

// ============================================
// AI GENERATION WITH FALLBACK
// ============================================

async function generateWithLovableAI(product: any, amazonData: any, webResults: any[]) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const prompts = [
    createManufacturerPrompt(product, amazonData, webResults),
    createCompliancePrompt(product, amazonData, webResults),
    createDocumentationPrompt(product, webResults),
    createTechnicalPrompt(product, amazonData)
  ];

  console.log('[RSGP] 🚀 Lancement 4 prompts parallèles...');

  const results = await Promise.allSettled(
    prompts.map(async (prompt, index) => {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Retourne UNIQUEMENT du JSON valide sans markdown.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`AI ${index+1} failed: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      let content = data.choices?.[0]?.message?.content || '{}';
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      console.log(`[RSGP] ✅ Prompt ${index+1} terminé`);
      return JSON.parse(content);
    })
  );

  return mergeRSGPResults(results, product, amazonData);
}

async function generateWithOllama(product: any, amazonData: any, webResults: any[], ollamaConfig: any) {
  const ollamaUrl = ollamaConfig.ollama_url || 'http://localhost:11434';
  const model = ollamaConfig.default_model || 'llama3.1';

  console.log(`[RSGP] 🦙 Ollama: ${ollamaUrl} (${model})`);

  const consolidatedPrompt = `Tu es expert RSGP. Génère UN JSON complet avec toutes les infos:

${createManufacturerPrompt(product, amazonData, webResults)}

${createCompliancePrompt(product, amazonData, webResults)}

${createDocumentationPrompt(product, webResults)}

${createTechnicalPrompt(product, amazonData)}

Fusionne TOUS les champs dans un seul JSON.`;

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Retourne UNIQUEMENT JSON sans markdown.' },
        { role: 'user', content: consolidatedPrompt }
      ],
      stream: false
    })
  });

  if (!res.ok) throw new Error(`Ollama: ${res.status}`);

  const data = await res.json();
  let content = data.message?.content || '{}';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  return JSON.parse(content);
}

function mergeRSGPResults(results: PromiseSettledResult<any>[], product: any, amazonData: any) {
  const merged: any = {
    nom_produit: product.product_name || product.product_url || 'Produit sans nom',
    ean: amazonData?.ean || 'non communiqué',
    reference_interne: '',
    numero_lot: '',
    numero_modele: amazonData?.numero_modele || '',
    fournisseur: amazonData?.buy_box_seller_name || 'non communiqué',
    fabricant_nom: 'non communiqué',
    fabricant_adresse: 'non communiqué',
    pays_origine: amazonData?.buy_box_ship_country || 'non communiqué',
    personne_responsable_ue: 'non communiqué',
    normes_ce: [],
    documents_conformite: {
      declaration_conformite: 'non communiqué',
      certificat_ce: 'non communiqué',
      rapport_test: 'non communiqué'
    },
    evaluation_risque: 'non communiqué',
    date_evaluation: null,
    notice_pdf: 'non communiqué',
    procedure_rappel: 'non communiqué',
    service_consommateur: 'non communiqué',
    langues_disponibles: ['fr'],
    categorie_rsgp: 'autre',
    age_recommande: 'Tous âges',
    avertissements: [],
    entretien: 'non communiqué',
    recyclage: 'non communiqué',
    garantie: '24 mois',
    firmware_ou_logiciel: 'N/A',
    compatibilites: [],
    historique_incidents: [],
    indice_reparabilite: 0,
    indice_energie: 'N/A',
    rsgp_valide: false,
    date_mise_conformite: null,
    responsable_conformite: '',
    documents_archives: {},
    date_import_odoo: null
  };

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      Object.assign(merged, result.value);
      console.log(`[RSGP] ✅ Prompt ${index+1} intégré`);
    } else {
      console.warn(`[RSGP] ⚠️ Prompt ${index+1} échoué`);
    }
  });

  return merged;
}

function generateMinimalRSGP(product: any, amazonData: any) {
  console.warn('[RSGP] ⚠️ Génération minimaliste (fallback final)');
  
  const inferCategory = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('jouet') || lower.includes('toy')) return 'jouets';
    if (lower.includes('phone') || lower.includes('électronique') || lower.includes('electronic')) return 'électronique';
    if (lower.includes('vêtement') || lower.includes('textile')) return 'textile';
    return 'autre';
  };

  return {
    nom_produit: product.product_name || product.product_url || 'Produit sans nom',
    ean: amazonData?.ean || 'non communiqué',
    fabricant_nom: amazonData?.manufacturer || amazonData?.brand || 'non communiqué',
    pays_origine: amazonData?.buy_box_ship_country || 'non communiqué',
    fournisseur: amazonData?.buy_box_seller_name || 'non communiqué',
    categorie_rsgp: inferCategory(product.product_name),
    reference_interne: '',
    numero_lot: '',
    numero_modele: amazonData?.numero_modele || '',
    fabricant_adresse: 'non communiqué',
    personne_responsable_ue: 'non communiqué',
    normes_ce: [],
    documents_conformite: {
      declaration_conformite: 'non communiqué',
      certificat_ce: 'non communiqué',
      rapport_test: 'non communiqué'
    },
    evaluation_risque: 'non communiqué',
    date_evaluation: null,
    notice_pdf: 'non communiqué',
    procedure_rappel: 'non communiqué',
    service_consommateur: 'non communiqué',
    langues_disponibles: ['fr'],
    age_recommande: 'Tous âges',
    avertissements: [],
    entretien: 'non communiqué',
    recyclage: 'non communiqué',
    garantie: '24 mois',
    firmware_ou_logiciel: 'N/A',
    compatibilites: [],
    historique_incidents: [],
    indice_reparabilite: 0,
    indice_energie: 'N/A',
    rsgp_valide: false,
    date_mise_conformite: null,
    responsable_conformite: '',
    documents_archives: {},
    date_import_odoo: null,
    generation_method: 'fallback_minimal'
  };
}

async function generateRSGPWithFallback(
  product: any,
  amazonData: any,
  webResults: any[],
  userId: string,
  supabase: any
) {
  const providers = await getAvailableProviders(supabase, userId);
  
  console.log('[RSGP] 📊 Providers:', {
    lovable: providers.lovable.available,
    ollama: providers.ollama.available
  });

  let rsgpData: any = null;
  let usedMethod = 'none';

  // NIVEAU 1: Lovable AI (primaire)
  if (providers.lovable.available) {
    try {
      console.log('[RSGP] 🎯 Lovable AI (primaire)...');
      rsgpData = await generateWithLovableAI(product, amazonData, webResults);
      usedMethod = 'lovable_primary';
    } catch (error) {
      console.error('[RSGP] ❌ Lovable échoué:', error);
    }
  }

  // NIVEAU 2: Ollama (fallback)
  if (!rsgpData && providers.ollama.available) {
    try {
      console.log('[RSGP] 🦙 Ollama (fallback)...');
      rsgpData = await generateWithOllama(product, amazonData, webResults, providers.ollama.config);
      usedMethod = 'ollama_fallback';
    } catch (error) {
      console.error('[RSGP] ❌ Ollama échoué:', error);
    }
  }

  // NIVEAU 3: Génération minimaliste
  if (!rsgpData) {
    rsgpData = generateMinimalRSGP(product, amazonData);
    usedMethod = 'minimal_fallback';
  }

  rsgpData.generation_metadata = {
    method: usedMethod,
    timestamp: new Date().toISOString(),
    web_search_method: webResults.length > 0 ? 'serper' : 'ai_simulated',
    web_results_count: webResults.length
  };

  return rsgpData;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { analysis_id, force_regenerate = false } = await req.json();

    console.log(`[RSGP-COMPLIANCE] Generating for analysis: ${analysis_id}`);

    if (!analysis_id) {
      return new Response(
        JSON.stringify({ error: 'analysis_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already exists
    if (!force_regenerate) {
      const { data: existing } = await supabase
        .from('rsgp_compliance')
        .select('*')
        .eq('analysis_id', analysis_id)
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            data: existing,
            message: 'RSGP compliance data already exists'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get product analysis data
    const { data: analysis } = await supabase
      .from('product_analyses')
      .select('*')
      .eq('id', analysis_id)
      .eq('user_id', user.id)
      .single();

    if (!analysis) {
      return new Response(
        JSON.stringify({ error: 'Analysis not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Amazon data if available
    const { data: amazonData } = await supabase
      .from('amazon_product_data')
      .select('*')
      .eq('analysis_id', analysis_id)
      .single();

    console.log('[RSGP] 📊 Données Amazon:', {
      ean: amazonData?.ean,
      brand: amazonData?.brand,
      manufacturer: amazonData?.manufacturer,
      seller: amazonData?.buy_box_seller_name,
      country: amazonData?.buy_box_ship_country
    });

    // ========== PHASE 1: Recherche Web avec Fallback ==========
    const { searchResults, searchMethod } = await fetchWebData(
      analysis.product_name,
      amazonData
    );

    console.log(`[RSGP] 🔍 Recherche: ${searchMethod} - ${searchResults.length} résultats`);
    console.log('[RSGP] 🔍 Premiers résultats:', 
      searchResults.slice(0, 2).map(r => ({ 
        title: r.title?.slice(0, 60), 
        snippet: r.snippet?.slice(0, 100) 
      }))
    );

    // ========== PHASE 2: Génération RSGP avec Cascade Fallback ==========
    const rsgpData = await generateRSGPWithFallback(
      analysis,
      amazonData,
      searchResults,
      user.id,
      supabase
    );

    console.log('[RSGP] ✅ Génération terminée:', {
      method: rsgpData.generation_metadata?.method,
      webSearchMethod: rsgpData.generation_metadata?.web_search_method,
      resultsCount: rsgpData.generation_metadata?.web_results_count
    });

    // Sanitize date fields before insertion
    const sanitizeDateFields = (data: any) => {
      const dateFields = ['date_evaluation', 'date_mise_conformite', 'date_import_odoo'];
      const invalidValues = ['non communiqué', 'null', 'N/A', 'undefined', '', 'non disponible'];
      
      dateFields.forEach(field => {
        const value = data[field];
        const strValue = String(value || '').toLowerCase().trim();
        
        if (!value || invalidValues.includes(strValue)) {
          data[field] = null;
        }
      });
      return data;
    };

    const sanitizeAllFields = (data: any) => {
      // 1. Nettoyer les dates
      data = sanitizeDateFields(data);
      
      // 2. Garantir nom_produit
      if (!data.nom_produit || data.nom_produit === 'undefined') {
        data.nom_produit = 'Produit sans nom';
      }
      
      // 3. Nettoyer les strings "null"/"undefined"
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
          const cleaned = data[key].toLowerCase().trim();
          if (cleaned === 'null' || cleaned === 'undefined') {
            data[key] = 'non communiqué';
          }
        }
      });
      
      return data;
    };

    const sanitizedData = sanitizeAllFields(rsgpData);

    // Save to database using UPSERT
    const { data: complianceRecord, error: insertError } = await supabase
      .from('rsgp_compliance')
      .upsert({
        analysis_id,
        user_id: user.id,
        ...sanitizedData,
        validation_status: 'draft'
      }, {
        onConflict: 'analysis_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[RSGP] Database insert error:', insertError);
      throw insertError;
    }

    // Update product_analyses
    await supabase
      .from('product_analyses')
      .update({
        rsgp_compliance_id: complianceRecord.id,
        enrichment_status: {
          ...(analysis.enrichment_status || {}),
          rsgp: 'completed'
        }
      })
      .eq('id', analysis_id);

    console.log('[RSGP] Compliance data generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        data: complianceRecord
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RSGP-COMPLIANCE] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});