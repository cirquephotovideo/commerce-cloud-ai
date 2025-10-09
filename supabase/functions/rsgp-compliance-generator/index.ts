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

// ============================================
// WEB SEARCH FUNCTIONS (Multi-Source)
// ============================================

async function searchViaSerper(queries: string[]): Promise<any[]> {
  const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
  if (!SERPER_API_KEY) return [];

  const searchPromises = queries.map(async (q) => {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q, num: 6 })
    });
    const data = await res.json();
    return (data.organic || []).map((r: any) => ({ ...r, query: q, source: 'serper' }));
  });

  const results = await Promise.all(searchPromises);
  return results.flat();
}

async function searchViaOpenRouter(queries: string[], userId: string, supabase: any): Promise<any[]> {
  const { data: config } = await supabase
    .from('ai_provider_configs')
    .select('api_key_encrypted')
    .eq('provider', 'openrouter')
    .eq('is_active', true)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .maybeSingle();
  
  if (!config?.api_key_encrypted) return [];

  const results: any[] = [];
  
  for (const query of queries) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.api_key_encrypted}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet:online',
          messages: [{
            role: 'user',
            content: `Recherche web pour RSGP : ${query}
            
Trouve 4-6 résultats pertinents avec:
- Titre exact de la page
- URL complète (https://...)
- Extrait informatif (50-150 mots)

Focus sur : fabricants officiels, certifications CE, documentations techniques, rappels RAPEX.

Format JSON:
[
  {"title": "...", "link": "...", "snippet": "..."}
]`
          }],
          temperature: 0.3
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '[]';
        const parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```/g, ''));
        results.push(...parsed.map((r: any) => ({ ...r, query, source: 'openrouter_online' })));
      }
    } catch (error) {
      console.warn(`[RSGP] OpenRouter query failed for: ${query}`, error);
    }
  }
  
  return results;
}

async function searchViaLovableGrounding(queries: string[]): Promise<any[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return [];

  const results: any[] = [];
  
  for (const query of queries) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: `Recherche web RSGP : ${query}
            
Utilise tes capacités de recherche web pour trouver 4-6 résultats réels et pertinents.

Retourne un tableau JSON:
[
  {"title": "Titre exact", "link": "URL complète https://...", "snippet": "Extrait informatif"}
]`
          }]
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '[]';
        const cleaned = content.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          results.push(...parsed.map((r: any) => ({ ...r, query, source: 'lovable_grounding' })));
        } catch {
          console.warn(`[RSGP] Failed to parse Lovable response for: ${query}`);
        }
      }
    } catch (error) {
      console.warn(`[RSGP] Lovable Grounding query failed for: ${query}`, error);
    }
  }
  
  return results;
}

async function fetchWebDataMultiSource(
  productName: string, 
  productBrand?: string, 
  productEan?: string,
  userId?: string,
  supabase?: any
): Promise<{ searchResults: any[], searchMethod: string }> {
  
  const brand = productBrand || '';
  const ean = productEan || '';
  
  // 🎯 12 queries optimisées RSGP
  const queries = [
    // Fabricant & Contact
    `${brand || productName} manufacturer official contact address EU representative`,
    `${productName} ${brand} country origin made in fabrication location`,
    
    // Conformité & Certifications
    `${productName} ${ean} CE certificate declaration conformity PDF download`,
    `${brand || productName} safety datasheet MSDS compliance ISO EN standards`,
    `${productName} ${brand} certifications list ISO EN IEC UN38.3`,
    
    // Documentation
    `${productName} user manual instructions notice PDF download`,
    `${productName} ${brand} warranty garantie service client support`,
    
    // Sécurité & Rappels
    `${productName} ${ean} RAPEX recall alert safety notification`,
    `${productName} ${brand} product safety incidents reports`,
    
    // Indices & Labels
    `${productName} indice réparabilité France repair index score`,
    `${productName} ${brand} energy label efficiency rating A-G`,
    `${productName} recycling DEEE disposal instructions electronic waste`
  ];

  let searchResults: any[] = [];
  let searchMethod = 'none';

  // ✅ Stratégie 1 : Serper API (si configuré)
  const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
  if (SERPER_API_KEY) {
    try {
      searchResults = await searchViaSerper(queries);
      if (searchResults.length > 0) {
        searchMethod = 'serper';
        console.log(`✅ [RSGP] Serper: ${searchResults.length} résultats`);
        return { searchResults, searchMethod };
      }
    } catch (error) {
      console.warn('⚠️ [RSGP] Serper failed:', error);
    }
  }

  // ✅ Stratégie 2 : OpenRouter :online (si configuré)
  if (userId && supabase) {
    try {
      searchResults = await searchViaOpenRouter(queries, userId, supabase);
      if (searchResults.length > 0) {
        searchMethod = 'openrouter_online';
        console.log(`✅ [RSGP] OpenRouter :online: ${searchResults.length} résultats`);
        return { searchResults, searchMethod };
      }
    } catch (error) {
      console.warn('⚠️ [RSGP] OpenRouter failed:', error);
    }
  }

  // ✅ Stratégie 3 : Lovable AI avec Grounding
  try {
    searchResults = await searchViaLovableGrounding(queries);
    if (searchResults.length > 0) {
      searchMethod = 'lovable_grounding';
      console.log(`✅ [RSGP] Lovable Grounding: ${searchResults.length} résultats`);
      return { searchResults, searchMethod };
    }
  } catch (error) {
    console.warn('⚠️ [RSGP] Lovable Grounding failed:', error);
  }

  // ✅ Stratégie 4 : Fallback simulation IA (dernier recours)
  try {
    searchResults = await simulateWebSearchWithAI(productName, productBrand, productEan);
    searchMethod = 'ai_simulated';
    console.log(`⚠️ [RSGP] AI simulation (fallback): ${searchResults.length} résultats`);
  } catch (error) {
    console.error('❌ [RSGP] All search methods failed:', error);
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
      r.snippet?.toLowerCase().includes('address') ||
      r.snippet?.toLowerCase().includes('made in')
    )
    .slice(0, 6);

  return `MISSION CRITIQUE: Extraire coordonnées EXACTES du FABRICANT et RESPONSABLE UE

PRODUIT ANALYSÉ:
- Nom: ${product.product_name}
- Marque: ${derivedData?.brand || 'inconnue'}
- EAN: ${derivedData?.ean || 'inconnu'}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.query}] ${r.title} - ${r.snippet} (${r.link})`).join('\n')}

INSTRUCTIONS:
1. Cherche NOM COMPLET du fabricant (société, entreprise)
2. ADRESSE POSTALE complète (rue, ville, code postal, pays)
3. PAYS D'ORIGINE (code ISO-2: FR, DE, CN, US, etc.)
4. PERSONNE RESPONSABLE UE (nom + adresse complète)
5. SERVICE CONSOMMATEUR (email + téléphone)

RETOURNE EXACTEMENT CE JSON:
{
  "fabricant_nom": "...",
  "fabricant_adresse": "...",
  "pays_origine": "FR/DE/CN/US/etc.",
  "personne_responsable_ue": "...",
  "service_consommateur": "...",
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- Si info introuvable: "non communiqué"
- pays_origine: UNIQUEMENT codes ISO-2
- Inclure URLs sources utilisées`;
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
      r.snippet?.toLowerCase().includes('RAPEX') ||
      r.snippet?.toLowerCase().includes('recall')
    )
    .slice(0, 6);

  return `MISSION: Identifier CONFORMITÉ RÉGLEMENTAIRE et CERTIFICATIONS

PRODUIT: ${product.product_name}
CATÉGORIE: ${product.category || 'non définie'}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.snippet} - ${r.link}`).join('\n')}

CHERCHE:
1. NORMES CE (EN, ISO, IEC) - liste complète
2. DOCUMENTS conformité (URLs PDFs exacts)
3. NIVEAU RISQUE (faible/moyen/élevé + justification)
4. RAPPELS produit (RAPEX, signalement.gouv.fr)

JSON ATTENDU:
{
  "normes_ce": ["EN 60950-1", "ISO 9001"],
  "documents_conformite": {
    "declaration_conformite": "https://...",
    "certificat_ce": "https://...",
    "rapport_test": "https://..."
  },
  "evaluation_risque": "moyen - Justification détaillée",
  "historique_incidents": [
    {"date": "2024-03-15", "type": "rappel", "description": "...", "source": "url"}
  ],
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- URLs: UNIQUEMENT complètes et valides (https://...)
- evaluation_risque: TOUJOURS avec justification (batteries, électrique, enfants, chimique)
- historique_incidents: [] si aucun rappel trouvé`;
}

function createDocumentationPrompt(product: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('manual') ||
      r.snippet?.toLowerCase().includes('notice') ||
      r.snippet?.toLowerCase().includes('pdf') ||
      r.snippet?.toLowerCase().includes('instructions') ||
      r.snippet?.toLowerCase().includes('warranty') ||
      r.snippet?.toLowerCase().includes('garantie')
    )
    .slice(0, 6);

  return `MISSION: Localiser DOCUMENTATION et SERVICE CLIENT

PRODUIT: ${product.product_name}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.link} - ${r.snippet}`).join('\n')}

TROUVE:
1. URL NOTICE PDF (manuel utilisateur téléchargeable)
2. PROCÉDURE RAPPEL (50-200 mots: contact, délais, remboursement)
3. SERVICE CONSOMMATEUR (contact précis)
4. LANGUES disponibles (codes ISO)

JSON:
{
  "notice_pdf": "https://example.com/manual.pdf",
  "procedure_rappel": "En cas de défaut...",
  "service_consommateur": "support@example.com / +33 1 XX XX XX XX",
  "langues_disponibles": ["fr", "en", "de"],
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- notice_pdf: URL complète .pdf uniquement, "non communiqué" si introuvable
- procedure_rappel: texte clair avec étapes
- service_consommateur: format "email / téléphone"
- langues_disponibles: codes ISO-2 (fr, en, de, es, it)`;
}

function createTechnicalPrompt(product: any, derivedData: any) {
  return `MISSION: CARACTÉRISTIQUES TECHNIQUES et SÉCURITÉ

PRODUIT: ${product.product_name}
DESCRIPTION: ${product.description || 'non disponible'}

DÉTERMINE:
1. CATÉGORIE RSGP (jouets|électronique|textile|cosmétiques|alimentaire|autre)
2. ÂGE recommandé
3. AVERTISSEMENTS sécurité (2-5 items précis)
4. ENTRETIEN (instructions)
5. RECYCLAGE (logo DEEE, consignes)
6. GARANTIE (durée)
7. INDICE RÉPARABILITÉ (0-10)
8. INDICE ÉNERGIE (A-G ou N/A)

JSON:
{
  "categorie_rsgp": "électronique",
  "age_recommande": "3+ ans",
  "avertissements": ["Ne pas jeter au feu (batterie lithium)", "Risque électrique"],
  "entretien": "...",
  "recyclage": "Logo DEEE - À déposer en point de collecte",
  "garantie": "24 mois",
  "indice_reparabilite": 6.5,
  "indice_energie": "A+",
  "firmware_ou_logiciel": "v2.1.0",
  "compatibilites": ["iOS 15+", "Android 11+"]
}

LOGIQUE:
- indice_reparabilite: 0=impossible, 10=très facile
- avertissements: SPÉCIFIQUES au produit (batteries, électrique, étouffement, allergènes)`;
}

// ============================================
// AI GENERATION WITH FALLBACK
// ============================================

async function generateWithLovableAI(product: any, derivedData: any, webResults: any[], webSearchData: { searchResults: any[], searchMethod: string }) {
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

  return mergeRSGPResults(results, product, derivedData, webSearchData);
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

function mergeRSGPResults(
  results: PromiseSettledResult<any>[], 
  product: any, 
  derivedData: any, 
  webSearchData: { searchResults: any[], searchMethod: string }
) {
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

  const usedSources: string[] = [];

  // ✅ Collecter les URLs sources des résultats web
  webSearchData.searchResults.forEach((result: any) => {
    if (result.link && result.link.startsWith('http')) {
      usedSources.push(result.link);
    }
  });

  // ✅ Merge des résultats IA et collecte des sources
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      const promptData = result.value;
      
      // Prioriser les données non vides
      Object.keys(promptData).forEach(key => {
        const value = promptData[key];
        const isEmpty = !value || value === 'non communiqué' || value === 'N/A' || value === '';
        
        if (!isEmpty && (!merged[key] || merged[key] === 'non communiqué')) {
          merged[key] = value;
        }
      });

      // Collecter les sources_urls des prompts
      if (promptData.sources_urls) {
        usedSources.push(...promptData.sources_urls);
      }
      
      console.log(`[RSGP] ✅ Prompt ${index+1} (${['Fabricant', 'Conformité', 'Documentation', 'Technique'][index]}) intégré`);
    } else {
      console.warn(`[RSGP] ⚠️ Prompt ${index+1} échoué:`, result.status === 'rejected' ? result.reason : 'unknown');
    }
  });

  // ✅ Métadonnées enrichies avec sources
  merged.generation_metadata = {
    method: webSearchData.searchMethod,
    timestamp: new Date().toISOString(),
    web_results_count: webSearchData.searchResults.length,
    sources_urls: [...new Set(usedSources)],
    queries_executed: [...new Set(webSearchData.searchResults.map((r: any) => r.query))]
  };

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
  webSearchData: { searchResults: any[], searchMethod: string },
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
      rsgpData = await generateWithLovableAI(product, derivedData, webSearchData.searchResults, webSearchData);
      usedMethod = 'lovable_primary';
    } catch (error) {
      console.error('[RSGP] ❌ Lovable échoué:', error);
    }
  }

  // NIVEAU 2: OpenRouter (fallback)
  if (!rsgpData && providers.openrouter.available) {
    try {
      console.log('[RSGP] 🌐 OpenRouter (fallback)...');
      rsgpData = await generateWithOpenRouter(product, derivedData, webSearchData.searchResults, providers.openrouter.config);
      usedMethod = 'openrouter_fallback';
    } catch (error) {
      console.error('[RSGP] ❌ OpenRouter échoué:', error);
    }
  }

  // NIVEAU 3: Ollama (fallback)
  if (!rsgpData && providers.ollama.available) {
    try {
      console.log('[RSGP] 🦙 Ollama (fallback)...');
      rsgpData = await generateWithOllama(product, derivedData, webSearchData.searchResults, providers.ollama.config);
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
    web_search_method: webSearchData.searchMethod,
    web_results_count: webSearchData.searchResults.length
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
    // ✅ AMÉLIORATION: Extraction robuste du nom du produit
    const productName = analysis.product_name || 
                       analysis.analysis_result?.title || 
                       analysis.analysis_result?.product_name ||
                       analysis.product_url ||
                       'Produit sans nom';
    
    console.log(`[RSGP] 📦 Produit: "${productName}"`);
    console.log(`[RSGP] 🏷️  Marque: "${derivedData.brand || 'inconnue'}"`);
    console.log(`[RSGP] 🔢 EAN: "${derivedData.ean || 'inconnu'}"`);

    const webSearchData = await fetchWebDataMultiSource(
      productName,
      derivedData.brand,
      derivedData.ean,
      user.id,
      supabase
    );

    console.log(`[RSGP] 🔍 Recherche: ${webSearchData.searchMethod} - ${webSearchData.searchResults.length} résultats`);
    console.log('[RSGP] 🔍 Premiers résultats:', 
      webSearchData.searchResults.slice(0, 2).map((r: any) => ({ 
        title: r.title?.slice(0, 60), 
        snippet: r.snippet?.slice(0, 100) 
      }))
    );

    // ========== PHASE 2: Génération RSGP avec Cascade Fallback ==========
    let rsgpData = await generateRSGPWithFallback(
      analysis,
      derivedData,
      webSearchData,
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