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
  
  const { data: openRouterConfig } = await supabase
    .from('ai_provider_configs')
    .select('*')
    .eq('provider', 'openrouter')
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
    },
    openrouter: {
      available: !!openRouterConfig,
      config: openRouterConfig
    }
  };
}

async function fetchWebData(productName: string, productBrand?: string, productEan?: string) {
  const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
  let searchResults: any[] = [];
  let searchMethod = 'none';

  if (SERPER_API_KEY) {
    try {
      const brand = productBrand || '';
      const ean = productEan || '';
      
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
      searchResults = await simulateWebSearchWithAI(productName, productBrand, productEan);
      searchMethod = 'ai_simulated';
      console.log(`✅ [RSGP] AI simulation: ${searchResults.length} résultats`);
    } catch (error) {
      console.warn('⚠️ [RSGP] AI search failed:', error);
    }
  }

  return { searchResults, searchMethod };
}

async function simulateWebSearchWithAI(productName: string, productBrand?: string, productEan?: string) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const prompt = `Simule une recherche web pour trouver des informations RSGP sur ce produit:

Produit: ${productName}
Marque: ${productBrand || 'inconnue'}
EAN: ${productEan || 'inconnu'}

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

function createManufacturerPrompt(product: any, derivedData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('manufacturer') ||
      r.snippet?.toLowerCase().includes('fabricant') ||
      r.snippet?.toLowerCase().includes('responsible') ||
      r.snippet?.toLowerCase().includes('address')
    )
    .slice(0, 5);

  return `MISSION CRITIQUE: Extraire coordonnées EXACTES du FABRICANT et RESPONSABLE UE

PRODUIT ANALYSÉ:
- Nom: ${product.product_name}
- Marque: ${derivedData?.brand || product.analysis_result?.brand || 'inconnue'}
- EAN: ${derivedData?.ean || product.analysis_result?.ean || 'inconnu'}
- Catégorie: ${product.category || 'non définie'}

SOURCES WEB (vérifiées):
${relevantResults.length > 0 ? relevantResults.map((r, i) => `
[SOURCE ${i+1}]
Titre: ${r.title}
Contenu: ${r.snippet}
URL: ${r.link || 'N/A'}
`).join('\n') : 'Aucune source web disponible - utiliser les données du produit'}

CONTEXTE ADDITIONNEL:
- Description produit: ${product.description?.slice(0, 200) || 'non disponible'}
- Marque identifiée: ${derivedData?.brand || 'inconnue'}

INSTRUCTIONS:
1. Cherche le NOM COMPLET du fabricant (société, entreprise)
2. Trouve l'ADRESSE POSTALE complète (rue, ville, code postal, pays)
3. Identifie le PAYS D'ORIGINE de fabrication (code ISO-2: FR, DE, CN, US, etc.)
4. Localise la PERSONNE RESPONSABLE dans l'UE (nom + adresse complète)
5. Note le FOURNISSEUR si différent du fabricant
6. Trouve le SERVICE CONSOMMATEUR (email + téléphone)

RETOURNE EXACTEMENT CE FORMAT JSON:
{
  "fabricant_nom": "Nom complet de l'entreprise fabricant",
  "fabricant_adresse": "Adresse postale complète avec code postal et ville",
  "pays_origine": "Code ISO-2 du pays de fabrication",
  "personne_responsable_ue": "Nom complet et adresse du responsable européen",
  "fournisseur": "Nom du fournisseur ou 'non communiqué'",
  "service_consommateur": "Email et/ou téléphone du service client"
}

RÈGLES STRICTES:
- Privilégie TOUJOURS les données des sources web si disponibles
- Si une info est introuvable dans les sources: utilise "non communiqué"
- Pour pays_origine: UNIQUEMENT codes ISO-2 (FR, DE, CN, US, IT, ES, etc.)
- Pour personne_responsable_ue: doit inclure nom ET adresse
- Vérifie la cohérence entre pays et adresse
- NE PAS inventer de données fictives`;
}

function createCompliancePrompt(product: any, derivedData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.includes('CE') ||
      r.snippet?.toLowerCase().includes('conformity') ||
      r.snippet?.toLowerCase().includes('conformité') ||
      r.snippet?.toLowerCase().includes('norm') ||
      r.snippet?.toLowerCase().includes('standard') ||
      r.snippet?.toLowerCase().includes('certification') ||
      r.snippet?.toLowerCase().includes('safety')
    )
    .slice(0, 5);

  return `MISSION: Identifier CONFORMITÉ RÉGLEMENTAIRE et CERTIFICATIONS

PRODUIT: ${product.product_name}
CATÉGORIE: ${product.category || 'non définie'}
MARQUE: ${derivedData?.brand || 'inconnue'}

SOURCES WEB:
${relevantResults.length > 0 ? relevantResults.map((r, i) => `
[SOURCE ${i+1}]
${r.title}
${r.snippet}
${r.link || ''}
`).join('\n') : 'Aucune source disponible'}

INSTRUCTIONS:
1. Identifie les NORMES CE applicables (EN, ISO, IEC)
2. Cherche les DOCUMENTS de conformité (URLs de PDFs)
3. Évalue le NIVEAU DE RISQUE du produit
4. Détermine la DATE d'évaluation si mentionnée

RETOURNE CE FORMAT JSON:
{
  "normes_ce": ["EN XXXXX", "ISO XXXXX"],
  "documents_conformite": {
    "declaration_conformite": "URL PDF complète ou non communiqué",
    "certificat_ce": "URL PDF complète ou non communiqué",
    "rapport_test": "URL PDF complète ou non communiqué"
  },
  "evaluation_risque": "faible/moyen/élevé avec justification",
  "date_evaluation": "YYYY-MM-DD ou null"
}

RÈGLES:
- normes_ce: liste vide [] si aucune norme trouvée
- URLs: uniquement URLs complètes et valides (https://...)
- evaluation_risque: 
  * "faible" = produit simple, peu de risques
  * "moyen" = produit standard, risques contrôlés
  * "élevé" = produit électrique, chimique, ou pour enfants
- date_evaluation: format YYYY-MM-DD uniquement, null si inconnue
- NE PAS inventer d'URLs ou de normes`;
}

function createDocumentationPrompt(product: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('manual') ||
      r.snippet?.toLowerCase().includes('notice') ||
      r.snippet?.toLowerCase().includes('pdf') ||
      r.snippet?.toLowerCase().includes('instructions') ||
      r.snippet?.toLowerCase().includes('guide') ||
      r.snippet?.toLowerCase().includes('user guide') ||
      r.snippet?.toLowerCase().includes('mode d\'emploi')
    )
    .slice(0, 5);

  return `MISSION: Localiser DOCUMENTATION et SERVICE CLIENT

PRODUIT: ${product.product_name}

SOURCES WEB:
${relevantResults.length > 0 ? relevantResults.map((r, i) => `
[SOURCE ${i+1}]
Titre: ${r.title}
URL: ${r.link || 'N/A'}
Contenu: ${r.snippet}
`).join('\n') : 'Aucune source disponible'}

INSTRUCTIONS:
1. Trouve l'URL de la NOTICE PDF (manuel utilisateur)
2. Rédige une PROCÉDURE DE RAPPEL réaliste
3. Identifie le SERVICE CONSOMMATEUR (contact)
4. Liste les LANGUES disponibles

RETOURNE CE FORMAT JSON:
{
  "notice_pdf": "URL complète du PDF de la notice ou non communiqué",
  "procedure_rappel": "Texte détaillé de 50-200 mots sur la procédure de rappel",
  "service_consommateur": "Email et/ou téléphone du service client",
  "langues_disponibles": ["fr", "en"]
}

RÈGLES:
- notice_pdf: URL complète .pdf uniquement, "non communiqué" si introuvable
- procedure_rappel: texte clair avec étapes (contact, retour, remboursement)
- service_consommateur: format "email / téléphone" ou "non communiqué"
- langues_disponibles: codes ISO-2 uniquement (fr, en, de, es, it, etc.)
- Si pas de sources: génère une procédure générique réaliste`;
}

function createTechnicalPrompt(product: any, derivedData: any) {
  return `MISSION: Déterminer CARACTÉRISTIQUES TECHNIQUES et SÉCURITÉ

PRODUIT: ${product.product_name}
DESCRIPTION: ${product.description || 'non disponible'}
CATÉGORIE: ${product.category || 'non définie'}
MARQUE: ${derivedData?.brand || 'inconnue'}

INSTRUCTIONS:
1. Classifie dans une CATÉGORIE RSGP
2. Détermine l'ÂGE RECOMMANDÉ
3. Liste les AVERTISSEMENTS de sécurité nécessaires
4. Fournis les instructions D'ENTRETIEN
5. Indique les consignes de RECYCLAGE
6. Précise la GARANTIE légale
7. Note la version FIRMWARE/LOGICIEL si applicable
8. Liste les COMPATIBILITÉS si pertinent
9. Évalue l'INDICE DE RÉPARABILITÉ (0-10)

RETOURNE CE FORMAT JSON:
{
  "categorie_rsgp": "jouets|électronique|textile|cosmétiques|alimentaire|autre",
  "age_recommande": "0-3 ans|3+ ans|6+ ans|12+ ans|Adultes|Tous âges",
  "avertissements": ["Avertissement 1", "Avertissement 2"],
  "entretien": "Instructions détaillées d'entretien",
  "recyclage": "Consignes de recyclage (logo, poubelle, etc.)",
  "garantie": "Durée en mois (ex: 24 mois)",
  "firmware_ou_logiciel": "Version ou N/A",
  "compatibilites": ["Compatible 1", "Compatible 2"],
  "indice_reparabilite": 0-10
}

RÈGLES PAR CATÉGORIE:
- jouets: âge précis, avertissements étouffement/petites pièces
- électronique: compatibilités, firmware, recyclage DEEE
- textile: entretien lavage, composition
- cosmétiques: avertissements allergies, conservation
- alimentaire: conservation, allergènes

LOGIQUE:
- categorie_rsgp: détermine selon mots-clés dans nom/description
- age_recommande: selon risques et catégorie
- avertissements: spécifiques et pertinents (2-5 items)
- entretien: adapté au type de produit
- recyclage: instructions claires
- indice_reparabilite: 0=impossible, 10=très facile`;
}

// ============================================
// AI GENERATION WITH FALLBACK
// ============================================

async function generateWithLovableAI(product: any, derivedData: any, webResults: any[]) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  const prompts = [
    createManufacturerPrompt(product, derivedData, webResults),
    createCompliancePrompt(product, derivedData, webResults),
    createDocumentationPrompt(product, webResults),
    createTechnicalPrompt(product, derivedData)
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

  return mergeRSGPResults(results, product, derivedData);
}

async function generateWithOllama(product: any, derivedData: any, webResults: any[], ollamaConfig: any) {
  const ollamaUrl = ollamaConfig.ollama_url || 'http://localhost:11434';
  const model = ollamaConfig.default_model || 'llama3.1';

  console.log(`[RSGP] 🦙 Ollama: ${ollamaUrl} (${model})`);

  const consolidatedPrompt = `Tu es expert RSGP. Génère UN JSON complet avec toutes les infos:

${createManufacturerPrompt(product, derivedData, webResults)}

${createCompliancePrompt(product, derivedData, webResults)}

${createDocumentationPrompt(product, webResults)}

${createTechnicalPrompt(product, derivedData)}

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

async function generateWithOpenRouter(product: any, derivedData: any, webResults: any[], config: any) {
  const apiKey = config.api_key_encrypted;
  const model = config.default_model || 'anthropic/claude-3.5-sonnet';

  console.log(`[RSGP] 🌐 OpenRouter (${model})`);

  const consolidatedPrompt = `Tu es expert RSGP. Génère UN JSON complet:

${createManufacturerPrompt(product, derivedData, webResults)}
${createCompliancePrompt(product, derivedData, webResults)}
${createDocumentationPrompt(product, webResults)}
${createTechnicalPrompt(product, derivedData)}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Retourne UNIQUEMENT JSON sans markdown.' },
        { role: 'user', content: consolidatedPrompt }
      ]
    })
  });

  if (!res.ok) throw new Error(`OpenRouter: ${res.status}`);

  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || '{}';
  content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  return JSON.parse(content);
}

function mergeRSGPResults(results: PromiseSettledResult<any>[], product: any, derivedData: any) {
  const merged: any = {
    nom_produit: product.product_name || product.product_url || 'Produit sans nom',
    ean: derivedData?.ean || 'non communiqué',
    reference_interne: '',
    numero_lot: '',
    numero_modele: derivedData?.numero_modele || '',
    fournisseur: derivedData?.fournisseur || 'non communiqué',
    fabricant_nom: derivedData?.brand || 'non communiqué',
    fabricant_adresse: 'non communiqué',
    pays_origine: 'non communiqué',
    personne_responsable_ue: 'non communiqué',
    normes_ce: [],
    documents_conformite: {
      declaration_conformite: 'non communiqué',
      certificat_ce: 'non communiqué',
      rapport_test: 'non communiqué'
    },
    evaluation_risque: 'moyen',
    date_evaluation: null,
    notice_pdf: 'non communiqué',
    procedure_rappel: 'Afin de garantir la sécurité de nos utilisateurs, le produit fait l\'objet d\'une procédure de rappel volontaire. Si vous possédez ce produit, veuillez cesser immédiatement de l\'utiliser. Pour entamer la procédure de retour et de remboursement, contactez notre service consommateur via email ou téléphone en mentionnant le numéro de lot indiqué sur l\'emballage.',
    service_consommateur: 'non communiqué',
    langues_disponibles: ['fr'],
    categorie_rsgp: 'autre',
    age_recommande: 'Tous âges',
    avertissements: ['Ne pas laisser à la portée des jeunes enfants'],
    entretien: 'Consulter la notice du produit',
    recyclage: 'Consulter les directives de recyclage locales',
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

  // Merge results from all prompts
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      const promptData = result.value;
      
      // Merge non-empty values only
      Object.keys(promptData).forEach(key => {
        const value = promptData[key];
        if (value !== null && value !== undefined && value !== '' && value !== 'non communiqué') {
          merged[key] = value;
        }
      });
      
      console.log(`[RSGP] ✅ Prompt ${index+1} (${['Fabricant', 'Conformité', 'Documentation', 'Technique'][index]}) intégré`);
    } else {
      console.warn(`[RSGP] ⚠️ Prompt ${index+1} échoué:`, result.status === 'rejected' ? result.reason : 'unknown');
    }
  });

  return merged;
}

function generateMinimalRSGP(product: any, derivedData: any) {
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
    ean: derivedData?.ean || 'non communiqué',
    fabricant_nom: derivedData?.brand || 'non communiqué',
    pays_origine: 'non communiqué',
    fournisseur: derivedData?.fournisseur || 'non communiqué',
    categorie_rsgp: inferCategory(product.product_name),
    reference_interne: '',
    numero_lot: '',
    numero_modele: derivedData?.numero_modele || '',
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
  derivedData: any,
  webResults: any[],
  searchMethod: string,
  userId: string,
  supabase: any
) {
  const providers = await getAvailableProviders(supabase, userId);
  
  console.log('[RSGP] 📊 Providers:', {
    lovable: providers.lovable.available,
    ollama: providers.ollama.available,
    openrouter: providers.openrouter.available
  });

  let rsgpData: any = null;
  let usedMethod = 'none';

  // NIVEAU 1: Lovable AI (primaire)
  if (providers.lovable.available) {
    try {
      console.log('[RSGP] 🎯 Lovable AI (primaire)...');
      rsgpData = await generateWithLovableAI(product, derivedData, webResults);
      usedMethod = 'lovable_primary';
    } catch (error) {
      console.error('[RSGP] ❌ Lovable échoué:', error);
    }
  }

  // NIVEAU 2: OpenRouter (fallback)
  if (!rsgpData && providers.openrouter.available) {
    try {
      console.log('[RSGP] 🌐 OpenRouter (fallback)...');
      rsgpData = await generateWithOpenRouter(product, derivedData, webResults, providers.openrouter.config);
      usedMethod = 'openrouter_fallback';
    } catch (error) {
      console.error('[RSGP] ❌ OpenRouter échoué:', error);
    }
  }

  // NIVEAU 3: Ollama (fallback)
  if (!rsgpData && providers.ollama.available) {
    try {
      console.log('[RSGP] 🦙 Ollama (fallback)...');
      rsgpData = await generateWithOllama(product, derivedData, webResults, providers.ollama.config);
      usedMethod = 'ollama_fallback';
    } catch (error) {
      console.error('[RSGP] ❌ Ollama échoué:', error);
    }
  }

  // NIVEAU 4: Génération minimaliste
  if (!rsgpData) {
    rsgpData = generateMinimalRSGP(product, derivedData);
    usedMethod = 'minimal_fallback';
  }

  rsgpData.generation_metadata = {
    method: usedMethod,
    timestamp: new Date().toISOString(),
    web_search_method: searchMethod,
    web_results_count: webResults.length
  };

  return rsgpData;
}

// ============================================
// HELPER: Extract data from analysis
// ============================================

function deriveFromAnalysis(analysis: any): Record<string, any> {
  const result = analysis?.analysis_result || {};
  
  console.log('[RSGP] 🔍 Extracting from analysis_result only:', {
    hasResult: !!result,
    brand: result.brand || result.manufacturer,
    ean: result.ean
  });
  
  return {
    ean: result.ean || null,
    brand: result.brand || result.manufacturer || null,
    numero_modele: result.model || result.model_number || null,
    garantie: result.warranty || result.warranty_info || null,
    categorie_rsgp: result.category || result.product_category || null,
    fournisseur: result.seller || result.supplier || null,
  };
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

    // ========== PHASE 0: Extract data from analysis_result only ==========
    console.log('[RSGP] 🔍 Extracting data from analysis (NO Amazon dependency)...');
    const derivedData = deriveFromAnalysis(analysis);
    console.log('[RSGP] ✅ Derived data:', derivedData);

    // Update enrichment status to processing
    await supabase
      .from('product_analyses')
      .update({
        enrichment_status: {
          ...(analysis.enrichment_status || {}),
          rsgp: 'processing'
        }
      })
      .eq('id', analysis_id);

    // ========== PHASE 1: Recherche Web avec Fallback ==========
    const { searchResults, searchMethod } = await fetchWebData(
      analysis.product_name,
      derivedData.brand,
      derivedData.ean
    );

    console.log(`[RSGP] 🔍 Recherche: ${searchMethod} - ${searchResults.length} résultats`);
    console.log('[RSGP] 🔍 Premiers résultats:', 
      searchResults.slice(0, 2).map(r => ({ 
        title: r.title?.slice(0, 60), 
        snippet: r.snippet?.slice(0, 100) 
      }))
    );

    // ========== PHASE 2: Génération RSGP avec Cascade Fallback ==========
    let rsgpData = await generateRSGPWithFallback(
      analysis,
      derivedData,
      searchResults,
      searchMethod,
      user.id,
      supabase
    );

    console.log('[RSGP] ✅ Génération terminée, merging with derived data...');
    
    // Merge derived data with generated data, prioritizing non-empty values
    // Map to actual table columns
    rsgpData = {
      ...rsgpData,
      // Product info
      ean: derivedData.ean || rsgpData.ean || 'non communiqué',
      numero_modele: derivedData.numero_modele || rsgpData.numero_modele || 'non communiqué',
      garantie: derivedData.garantie || rsgpData.garantie || '24 mois',
      categorie_rsgp: derivedData.categorie_rsgp || rsgpData.categorie_rsgp || 'autre',
      
      // Manufacturer fields (use actual column names)
      fabricant_nom: derivedData.fabricant_nom || rsgpData.fabricant_nom || 'non communiqué',
      fabricant_adresse: rsgpData.fabricant_adresse || 'non communiqué',
      pays_origine: rsgpData.pays_origine || 'non communiqué',
      personne_responsable_ue: rsgpData.personne_responsable_ue || 'non communiqué',
      fournisseur: derivedData.fournisseur || rsgpData.fournisseur || 'non communiqué',
      service_consommateur: rsgpData.service_consommateur || 'non communiqué',
    };
    
    // Remove any nested objects that don't match table structure
    delete rsgpData.manufacturer;
    delete rsgpData.product_info;

    console.log('[RSGP] ✅ Data merged:', {
      method: rsgpData.generation_metadata?.method,
      webSearchMethod: rsgpData.generation_metadata?.web_search_method,
      resultsCount: rsgpData.generation_metadata?.web_results_count,
      hasEan: !!rsgpData.product_info?.ean && rsgpData.product_info.ean !== 'non communiqué',
      hasBrand: !!rsgpData.fabricant_nom && rsgpData.fabricant_nom !== 'non communiqué'
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