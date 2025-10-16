import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// ✅ Whitelist des colonnes rsgp_compliance (évite erreurs PostgREST)
const RSGP_ALLOWED_COLUMNS = [
  'analysis_id', 'user_id', 'nom_produit', 'reference_interne', 'ean', 
  'numero_lot', 'numero_modele', 'categorie_rsgp', 'fabricant_nom', 
  'fabricant_adresse', 'pays_origine', 'personne_responsable_ue', 
  'normes_ce', 'documents_conformite', 'evaluation_risque', 'date_evaluation',
  'firmware_ou_logiciel', 'procedure_rappel', 'historique_incidents', 
  'notice_pdf', 'avertissements', 'age_recommande', 'compatibilites',
  'entretien', 'recyclage', 'indice_reparabilite', 'indice_energie',
  'garantie', 'service_consommateur', 'langues_disponibles', 
  'rsgp_valide', 'date_mise_conformite', 'responsable_conformite',
  'documents_archives', 'fournisseur', 'date_import_odoo', 
  'fcc_id', 'fcc_data',  // ✅ NOUVEAU: FCC certifications
  'generation_metadata', 'validation_status'
];

// ✅ Domaines de confiance pour sources
const TRUSTED_DOMAINS = [
  'apple.com', 'support.apple.com', 'ec.europa.eu', 'europa.eu',
  'gouv.fr', 'gov.uk', 'iso.org', 'iec.ch', 'bsigroup.com',
  'tuv.com', 'sgs.com', 'ul.com', 'intertek.com'
];

// ✅ Validation URL avec HEAD request (timeout 5s)
async function validateUrlHead(url: string): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  
  console.log(`[RSGP] 🔗 Validation URL: ${url.substring(0, 80)}...`);
  console.log(`  - Est PDF: ${isPdf(url) ? '✅' : '❌'}`);
  console.log(`  - Domaine confiance: ${isTrustedDomain(url) ? '✅' : '❌'}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'RSGP-Validator/1.0' }
    });
    
    clearTimeout(timeoutId);
    const isValid = response.ok && response.status === 200;
    console.log(`  - HEAD request: ${isValid ? '✅ 200 OK' : '❌ Échec'}`);
    return isValid;
  } catch (error) {
    console.warn(`[RSGP] ❌ URL validation failed: ${url}`, error);
    return false;
  }
}

// ✅ Vérifier si URL est un PDF
function isPdf(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('/pdf/');
}

// ✅ Vérifier si domaine est de confiance
function isTrustedDomain(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRUSTED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

// ✅ Normaliser les normes (EN 12345, ISO 9001, etc.)
function normalizeStandard(str: string): string {
  const match = str.match(/(EN|ISO|IEC|UN)\s*(\d+(?:[-:]\d+)*)/i);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : str;
}

// ✅ Filtrer objet selon whitelist
function pickWhitelist<T extends Record<string, any>>(obj: T, allowedKeys: string[]): Partial<T> {
  const result: any = {};
  allowedKeys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

// ============================================
// FCC ID SEARCH & DATA FETCHING
// ============================================

// ✅ Rechercher FCC ID via Serper
async function searchFCCId(productName: string, brand: string, model: string): Promise<string | null> {
  console.log(`[FCC] 🔍 Recherche FCC ID pour: ${productName} ${brand} ${model}`);
  
  const serperKey = Deno.env.get('SERPER_API_KEY');
  if (!serperKey) {
    console.warn('[FCC] ⚠️ SERPER_API_KEY manquante, recherche FCC désactivée');
    return null;
  }
  
  // Construire des requêtes de recherche optimisées
  const searchQueries = [
    `${brand} ${model} FCC ID`,
    `"${productName}" FCC certification`,
    `${brand} ${model} wireless certification FCC`,
    `site:fccid.io ${brand} ${model}`
  ];
  
  for (const query of searchQueries) {
    try {
      console.log(`[FCC] 🔎 Query: "${query}"`);
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: 5 })
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const results = data.organic || [];
      
      // Extraire FCC ID des résultats (format: ABC-12345 ou ABC12345)
      const fccIdPattern = /\b[A-Z0-9]{3,5}-?[A-Z0-9]{2,}\b/g;
      
      for (const result of results) {
        const text = `${result.title} ${result.snippet}`.toUpperCase();
        const matches = text.match(fccIdPattern);
        
        if (matches) {
          for (const match of matches) {
            // Vérifier que c'est un vrai FCC ID (contient grantee code)
            const cleaned = match.replace('-', '');
            if (cleaned.length >= 5 && cleaned.length <= 20) {
              const fccId = match.includes('-') ? match : `${match.slice(0, 3)}-${match.slice(3)}`;
              console.log(`[FCC] ✅ FCC ID trouvé: ${fccId}`);
              return fccId;
            }
          }
        }
      }
    } catch (error) {
      console.error(`[FCC] ❌ Erreur recherche:`, error);
    }
  }
  
  console.log('[FCC] ⚠️ Aucun FCC ID trouvé');
  return null;
}

// ✅ Récupérer données FCC depuis fccid.io
async function fetchFCCData(fccId: string): Promise<any> {
  console.log(`[FCC] 📡 Récupération des données pour FCC ID: ${fccId}`);
  
  try {
    const fccUrl = `https://fccid.io/${fccId}`;
    const response = await fetch(fccUrl, {
      headers: { 'User-Agent': 'RSGP-Analyzer/1.0' }
    });
    
    if (!response.ok) {
      console.warn(`[FCC] ⚠️ fccid.io returned ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Fonctions d'extraction
    const extractFromHtml = (pattern: RegExp): string => {
      const match = html.match(pattern);
      return match ? match[1].trim() : 'non communiqué';
    };
    
    const extractDocumentLinks = (): string[] => {
      const links: string[] = [];
      const docPattern = /href="(\/document\/[^"]*(?:pdf|PDF)[^"]*)"/g;
      let match;
      while ((match = docPattern.exec(html)) !== null) {
        links.push(`https://fccid.io${match[1]}`);
      }
      return links.slice(0, 20); // Limiter à 20 documents
    };
    
    const extractImageLinks = (): string[] => {
      const images: string[] = [];
      const imgPattern = /src="(\/document\/[^"]*(?:jpg|jpeg|png|gif)[^"]*)"/gi;
      let match;
      while ((match = imgPattern.exec(html)) !== null) {
        images.push(`https://fccid.io${match[1]}`);
      }
      return images.slice(0, 10); // Limiter à 10 images
    };
    
    // Parser les données
    const fccData = {
      fcc_id: fccId,
      grantee_code: fccId.split('-')[0],
      product_code: fccId.split('-')[1] || '',
      source_url: fccUrl,
      grantee_name: extractFromHtml(/<td[^>]*>Grantee<\/td>\s*<td[^>]*>(.*?)<\/td>/s),
      equipment_type: extractFromHtml(/<td[^>]*>Equipment Type<\/td>\s*<td[^>]*>(.*?)<\/td>/s),
      grant_date: extractFromHtml(/<td[^>]*>Grant Date<\/td>\s*<td[^>]*>(.*?)<\/td>/s),
      frequency_range: extractFromHtml(/<td[^>]*>Frequency Range<\/td>\s*<td[^>]*>(.*?)<\/td>/s),
      documents_urls: extractDocumentLinks(),
      images_urls: extractImageLinks()
    };
    
    console.log(`[FCC] ✅ Données récupérées:`, {
      grantee: fccData.grantee_name,
      equipment: fccData.equipment_type,
      docs_count: fccData.documents_urls.length,
      images_count: fccData.images_urls.length
    });
    
    return fccData;
    
  } catch (error) {
    console.error(`[FCC] ❌ Erreur récupération FCC data:`, error);
    return null;
  }
}

// ✅ Calculer score de confiance par section
function computeSectionConfidence(sectionData: any): number {
  let score = 0;
  
  // +0.5 si sources_urls non vides
  if (sectionData.sources_urls && Array.isArray(sectionData.sources_urls) && sectionData.sources_urls.length > 0) {
    score += 0.5;
  }
  
  // +0.5 si au moins 1 URL sur domaine trusted
  const trustedCount = (sectionData.sources_urls || []).filter((url: string) => isTrustedDomain(url)).length;
  if (trustedCount > 0) {
    score += 0.5;
  }
  
  // Cap à 1.0
  return Math.min(score, 1.0);
}

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
  
  console.log('[RSGP] 🌐 === DÉBUT RECHERCHE WEB ===');
  
  const brand = productBrand || '';
  const ean = productEan || '';
  
  // 🎯 Enhanced queries with "site:" targeting trusted domains
  const queries = [
    // Fabricant & Contact
    `${brand || productName} manufacturer official contact address EU representative`,
    `${productName} ${brand} country origin made in fabrication location`,
    
    // Site-specific: Official manufacturer sites
    ...(brand ? [
      `site:${brand.toLowerCase().replace(/\s+/g, '')}.com ${productName} compliance declaration`,
      `site:support.${brand.toLowerCase().replace(/\s+/g, '')}.com ${productName} manual PDF`
    ] : []),
    
    // Conformité & Certifications
    `${productName} ${ean} CE certificate declaration conformity PDF download`,
    `${brand || productName} safety datasheet MSDS compliance ISO EN standards`,
    `${productName} ${brand} certifications list ISO EN IEC UN38.3`,
    
    // Site-specific: EU safety databases
    `site:ec.europa.eu/safety-gate ${productName} ${brand}`,
    `site:signal.conso.gouv.fr ${productName} ${brand}`,
    
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

  console.log('[RSGP] 🎯 Requêtes générées:', queries);

  let searchResults: any[] = [];
  let searchMethod = 'none';

  // ✅ Stratégie 1 : Serper API (si configuré)
  const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
  console.log('[RSGP] 📡 Tentative Serper...');
  if (SERPER_API_KEY) {
    try {
      searchResults = await searchViaSerper(queries);
      if (searchResults.length > 0) {
        searchMethod = 'serper';
        console.log(`[RSGP] ✅ Serper: ${searchResults.length} résultats`);
        console.log('[RSGP] 📄 Premiers résultats Serper:', 
          searchResults.slice(0, 3).map(r => ({
            title: r.title?.substring(0, 80),
            hasSnippet: !!r.snippet,
            link: r.link
          }))
        );
        return { searchResults, searchMethod };
      } else {
        console.log('[RSGP] ⚠️ Serper: 0 résultats');
      }
    } catch (error) {
      console.warn('[RSGP] ⚠️ Serper failed:', error);
    }
  } else {
    console.log('[RSGP] ⚠️ SERPER_API_KEY non configurée');
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
// SPECIALIZED PROMPTS (8 prompts séparés)
// ============================================

function createProductInfoPrompt(product: any, derivedData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('model') ||
      r.snippet?.toLowerCase().includes('ean') ||
      r.snippet?.toLowerCase().includes('made in') ||
      r.snippet?.toLowerCase().includes('origin')
    )
    .slice(0, 5);

  return `MISSION: Identifier INFORMATIONS PRODUIT essentielles

PRODUIT: ${product.product_name}
MARQUE: ${derivedData?.brand || 'inconnue'}
EAN CONNU: ${derivedData?.ean || 'inconnu'}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.snippet} - ${r.link}`).join('\n')}

EXTRAIRE:
1. Nom exact du produit
2. Catégorie RSGP (électronique|jouets|textile|cosmétiques|alimentaire|autre)
3. Numéro de modèle
4. Code EAN/GTIN (si trouvé)
5. Pays d'origine (code ISO-2: FR, DE, CN, US, etc.)

JSON ATTENDU:
{
  "nom_produit": "...",
  "categorie_rsgp": "électronique",
  "numero_modele": "...",
  "ean": "...",
  "pays_origine": "FR",
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- "non communiqué" si info introuvable
- pays_origine: UNIQUEMENT codes ISO-2
- categorie_rsgp: choisir la plus pertinente`;
}

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

function createCertificationsPrompt(product: any, derivedData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.includes('CE') ||
      r.snippet?.includes('EN ') ||
      r.snippet?.includes('ISO ') ||
      r.snippet?.toLowerCase().includes('norm') ||
      r.snippet?.toLowerCase().includes('standard')
    )
    .slice(0, 5);

  return `MISSION: Lister TOUTES les NORMES et CERTIFICATIONS

PRODUIT: ${product.product_name}
CATÉGORIE: ${product.category || 'non définie'}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.snippet}`).join('\n')}

CHERCHE:
- Normes CE (EN, IEC, ISO)
- Certifications (RoHS, REACH, etc.)
- Standards de sécurité (UN 38.3 pour batteries, etc.)

JSON ATTENDU:
{
  "normes_ce": ["EN 60950-1", "EN 300 328", "ISO 9001", "UN 38.3"],
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- Normes en format exact (EN XXXXX-X, ISO XXXXX)
- Liste unique (pas de doublons)
- [] si aucune norme trouvée`;
}

function createComplianceDocsPrompt(product: any, derivedData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('declaration') ||
      r.snippet?.toLowerCase().includes('certificate') ||
      r.snippet?.toLowerCase().includes('pdf') ||
      r.link?.includes('compliance') ||
      r.link?.includes('.pdf')
    )
    .slice(0, 5);

  return `MISSION: Trouver DOCUMENTS DE CONFORMITÉ officiels (PDFs)

PRODUIT: ${product.product_name}
MARQUE: ${derivedData?.brand || 'inconnue'}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.link}`).join('\n')}

TROUVE:
1. Déclaration de conformité (PDF)
2. Certificat CE (PDF)
3. Rapport de test (PDF)

JSON ATTENDU:
{
  "documents_conformite": {
    "declaration_conformite": "https://example.com/conformity.pdf",
    "certificat_ce": "https://example.com/ce-cert.pdf",
    "rapport_test": "https://example.com/test-report.pdf"
  },
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- URLs COMPLÈTES https://... pointant vers PDFs
- "non communiqué" si introuvable
- Prioriser sites officiels fabricants`;
}

function createNoticeAndLanguagesPrompt(product: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('manual') ||
      r.snippet?.toLowerCase().includes('notice') ||
      r.snippet?.toLowerCase().includes('instructions') ||
      r.link?.includes('manual') ||
      r.link?.includes('.pdf')
    )
    .slice(0, 5);

  return `MISSION: Localiser NOTICE UTILISATEUR et LANGUES

PRODUIT: ${product.product_name}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.link}`).join('\n')}

TROUVE:
1. URL de la notice PDF (manuel utilisateur)
2. Langues disponibles (codes ISO)

JSON:
{
  "notice_pdf": "https://example.com/manual.pdf",
  "langues_disponibles": ["fr", "en", "de", "es"],
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- notice_pdf: URL complète .pdf, "non communiqué" si introuvable
- langues_disponibles: codes ISO-2 (fr, en, de, es, it, etc.)`;
}

function createSupportAndRecallPrompt(product: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('service') ||
      r.snippet?.toLowerCase().includes('support') ||
      r.snippet?.toLowerCase().includes('recall') ||
      r.snippet?.toLowerCase().includes('rapex') ||
      r.snippet?.toLowerCase().includes('warranty')
    )
    .slice(0, 5);

  return `MISSION: Identifier SERVICE CLIENT et RAPPELS

PRODUIT: ${product.product_name}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.snippet} - ${r.link}`).join('\n')}

TROUVE:
1. Procédure de rappel (texte 50-200 mots)
2. Historique incidents/rappels RAPEX
3. Service consommateur (contact)

JSON:
{
  "procedure_rappel": "En cas de défaut avéré, contactez...",
  "historique_incidents": [
    {"date": "2024-03-15", "type": "rappel", "description": "...", "source": "url"}
  ],
  "service_consommateur": "support@example.com / +33 1 XX XX XX XX",
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- procedure_rappel: texte clair avec étapes (contact, délais, remboursement)
- historique_incidents: [] si aucun rappel
- service_consommateur: format "email / téléphone"`;
}

function createSafetyAndTechnicalPrompt(product: any, derivedData: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('safety') ||
      r.snippet?.toLowerCase().includes('warning') ||
      r.snippet?.toLowerCase().includes('repair') ||
      r.snippet?.toLowerCase().includes('energy') ||
      r.snippet?.toLowerCase().includes('recycle')
    )
    .slice(0, 5);

  return `MISSION: SÉCURITÉ et CARACTÉRISTIQUES TECHNIQUES

PRODUIT: ${product.product_name}
DESCRIPTION: ${product.description || 'non disponible'}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.snippet}`).join('\n')}

DÉTERMINE:
1. ÂGE recommandé
2. AVERTISSEMENTS sécurité (2-5 items précis)
3. ENTRETIEN (instructions)
4. RECYCLAGE (consignes)
5. GARANTIE (durée)
6. INDICE RÉPARABILITÉ (0-10)
7. INDICE ÉNERGIE (A-G ou N/A)
8. FIRMWARE/Logiciel (version si applicable)
9. COMPATIBILITÉS (systèmes compatibles)

JSON:
{
  "age_recommande": "3+ ans",
  "avertissements": ["Ne pas jeter au feu (batterie lithium)", "Risque électrique"],
  "entretien": "Nettoyer avec un chiffon doux...",
  "recyclage": "Logo DEEE - À déposer en point de collecte",
  "garantie": "24 mois",
  "indice_reparabilite": 6.5,
  "indice_energie": "A+",
  "firmware_ou_logiciel": "v2.1.0",
  "compatibilites": ["iOS 15+", "Android 11+"],
  "sources_urls": ["url1", "url2"]
}

LOGIQUE:
- indice_reparabilite: 0=impossible, 10=très facile
- avertissements: SPÉCIFIQUES au produit (batteries, électrique, étouffement, allergènes)
- indice_energie: A-G pour électroménager, N/A sinon`;
}

function createRsgpStatusPrompt(product: any, webResults: any[]) {
  const relevantResults = webResults
    .filter(r => 
      r.snippet?.toLowerCase().includes('conformity') ||
      r.snippet?.toLowerCase().includes('compliance') ||
      r.snippet?.includes('CE') ||
      r.snippet?.toLowerCase().includes('rsgp')
    )
    .slice(0, 5);

  return `MISSION: Déterminer STATUT CONFORMITÉ RSGP

PRODUIT: ${product.product_name}

SOURCES WEB (${relevantResults.length} résultats):
${relevantResults.map(r => `[${r.title}] ${r.snippet}`).join('\n')}

ÉVALUE:
1. RSGP valide (Oui/En attente/Non conforme)
2. Statut du produit (actif/draft/retiré)

JSON:
{
  "rsgp_valide": "Oui",
  "validation_status": "draft",
  "sources_urls": ["url1", "url2"]
}

RÈGLES:
- rsgp_valide: "Oui" si certifications CE + conformité visible, "En attente" si manque docs, "Non conforme" si rappel/alerte
- validation_status: "draft" par défaut`;
}

// ============================================
// AI GENERATION WITH FALLBACK
// ============================================

async function generateWithLovableAI(product: any, derivedData: any, webResults: any[], webSearchData: { searchResults: any[], searchMethod: string }) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  // ✅ Tool definitions for structured extraction
  const tools = [
    {
      type: "function",
      function: {
        name: "extract_product_info",
        description: "Extract basic product information",
        parameters: {
          type: "object",
          properties: {
            nom_produit: { type: "string" },
            categorie_rsgp: { type: "string", enum: ["électronique", "jouets", "textile", "cosmétiques", "alimentaire", "autre"] },
            numero_modele: { type: "string" },
            ean: { type: "string" },
            pays_origine: { type: "string" },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["nom_produit", "categorie_rsgp", "sources_urls"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "extract_manufacturer",
        description: "Extract manufacturer contact details",
        parameters: {
          type: "object",
          properties: {
            fabricant_nom: { type: "string" },
            fabricant_adresse: { type: "string" },
            pays_origine: { type: "string" },
            personne_responsable_ue: { type: "string" },
            service_consommateur: { type: "string" },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["fabricant_nom", "sources_urls"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "extract_certifications",
        description: "Extract CE norms and certifications",
        parameters: {
          type: "object",
          properties: {
            normes_ce: { type: "array", items: { type: "string" } },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["normes_ce", "sources_urls"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "extract_compliance_docs",
        description: "Extract compliance document URLs",
        parameters: {
          type: "object",
          properties: {
            documents_conformite: {
              type: "object",
              properties: {
                declaration_conformite: { type: "string" },
                certificat_ce: { type: "string" },
                rapport_test: { type: "string" }
              }
            },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["documents_conformite", "sources_urls"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "extract_notice_languages",
        description: "Extract user manual and available languages",
        parameters: {
          type: "object",
          properties: {
            notice_pdf: { type: "string" },
            langues_disponibles: { type: "array", items: { type: "string" } },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["notice_pdf", "langues_disponibles", "sources_urls"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "extract_support_recall",
        description: "Extract customer service and recall information",
        parameters: {
          type: "object",
          properties: {
            procedure_rappel: { type: "string" },
            historique_incidents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  type: { type: "string" },
                  description: { type: "string" },
                  source: { type: "string" }
                }
              }
            },
            service_consommateur: { type: "string" },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["procedure_rappel", "historique_incidents", "sources_urls"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "extract_safety_technical",
        description: "Extract safety and technical characteristics",
        parameters: {
          type: "object",
          properties: {
            age_recommande: { type: "string" },
            avertissements: { type: "array", items: { type: "string" } },
            entretien: { type: "string" },
            recyclage: { type: "string" },
            garantie: { type: "string" },
            indice_reparabilite: { type: "number" },
            indice_energie: { type: "string" },
            firmware_ou_logiciel: { type: "string" },
            compatibilites: { type: "array", items: { type: "string" } },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["age_recommande", "avertissements", "sources_urls"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "extract_rsgp_status",
        description: "Determine RSGP compliance status",
        parameters: {
          type: "object",
          properties: {
            rsgp_valide: { type: "string", enum: ["Oui", "En attente", "Non conforme"] },
            validation_status: { type: "string", enum: ["draft", "validated", "rejected"] },
            sources_urls: { type: "array", items: { type: "string" } }
          },
          required: ["rsgp_valide", "validation_status", "sources_urls"],
          additionalProperties: false
        }
      }
    }
  ];

  const prompts = [
    createProductInfoPrompt(product, derivedData, webResults),
    createManufacturerPrompt(product, derivedData, webResults),
    createCertificationsPrompt(product, derivedData, webResults),
    createComplianceDocsPrompt(product, derivedData, webResults),
    createNoticeAndLanguagesPrompt(product, webResults),
    createSupportAndRecallPrompt(product, webResults),
    createSafetyAndTechnicalPrompt(product, derivedData, webResults),
    createRsgpStatusPrompt(product, webResults)
  ];

  console.log('[RSGP] 🤖 === DÉBUT GÉNÉRATION AI (8 PROMPTS) ===');

  const promptNames = ['ProductInfo', 'Fabricant', 'Certifications', 'ComplianceDocs', 'Notice', 'Support', 'Safety', 'Status'];

  const results = await Promise.allSettled(
    prompts.map(async (prompt, index) => {
      const tool = tools[index];
      const promptName = promptNames[index];
      
      console.log(`[RSGP] 📝 Prompt ${index + 1}/8: ${promptName}`);
      console.log(`[RSGP] 📊 Données d'entrée:`, {
        webResultsCount: webResults.length,
        hasProductName: !!product.product_name,
        hasBrand: !!derivedData?.brand
      });
      
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0.7,
          messages: [
            { role: 'user', content: prompt }
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: tool.function.name } }
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[RSGP] ❌ Prompt ${index+1} failed: ${res.status} - ${errorText}`);
        
        // Handle rate limits
        if (res.status === 429) {
          throw new Error('Rate limits exceeded - please try again later');
        }
        if (res.status === 402) {
          throw new Error('Payment required - please add credits to your Lovable AI workspace');
        }
        
        throw new Error(`AI ${index+1} failed: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[RSGP] ✅ Prompt ${index+1}/8 (${promptName}) terminé:`, {
          success: true,
          hasToolCall: true,
          dataKeys: Object.keys(args)
        });
        return args;
      }
      
      // Fallback if no tool call
      let content = data.choices?.[0]?.message?.content || '{}';
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(content);
      console.log(`[RSGP] ⚠️ Prompt ${index+1}/8 (${promptName}) sans tool call, fallback parsing`);
      return parsed;
    })
  );

  return mergeRSGPResults(results, product, derivedData, webSearchData);
}

async function generateWithOllama(product: any, derivedData: any, webResults: any[], ollamaConfig: any) {
  const ollamaUrl = ollamaConfig.ollama_url || 'http://localhost:11434';
  const model = ollamaConfig.default_model || 'llama3.1';

  console.log(`[RSGP] 🦙 Ollama: ${ollamaUrl} (${model})`);

  const consolidatedPrompt = `Tu es expert RSGP. Génère UN JSON complet avec toutes les infos:

${createProductInfoPrompt(product, derivedData, webResults)}

${createManufacturerPrompt(product, derivedData, webResults)}

${createCertificationsPrompt(product, derivedData, webResults)}

${createComplianceDocsPrompt(product, derivedData, webResults)}

${createNoticeAndLanguagesPrompt(product, webResults)}

${createSupportAndRecallPrompt(product, webResults)}

${createSafetyAndTechnicalPrompt(product, derivedData, webResults)}

${createRsgpStatusPrompt(product, webResults)}

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

${createProductInfoPrompt(product, derivedData, webResults)}
${createManufacturerPrompt(product, derivedData, webResults)}
${createCertificationsPrompt(product, derivedData, webResults)}
${createComplianceDocsPrompt(product, derivedData, webResults)}
${createNoticeAndLanguagesPrompt(product, webResults)}
${createSupportAndRecallPrompt(product, webResults)}
${createSafetyAndTechnicalPrompt(product, derivedData, webResults)}
${createRsgpStatusPrompt(product, webResults)}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
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
    numero_modele: derivedData?.numero_modele || 'non communiqué',
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
    rsgp_valide: 'En attente',
    validation_status: 'draft',
    date_mise_conformite: null,
    responsable_conformite: '',
    documents_archives: {},
    date_import_odoo: null
  };

  const usedSources: string[] = [];
  const sectionConfidence: Record<string, number> = {};

  // ✅ Collecter les URLs sources des résultats web
  webSearchData.searchResults.forEach((result: any) => {
    if (result.link && result.link.startsWith('http')) {
      usedSources.push(result.link);
    }
  });

  // ✅ Merge des 8 résultats IA avec validation stricte
  const promptNames = ['product_info', 'manufacturer', 'certifications', 'compliance_docs', 'notice', 'support', 'safety', 'status'];
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      const promptData = result.value;
      const sectionName = promptNames[index];
      
      // Calculer confiance pour cette section
      sectionConfidence[sectionName] = computeSectionConfidence(promptData);
      
      // Prioriser les données non vides sur "non communiqué"
      Object.keys(promptData).forEach(key => {
        // Ignorer clés hors whitelist dès maintenant
        if (!RSGP_ALLOWED_COLUMNS.includes(key) && key !== 'sources_urls') {
          return;
        }
        
        const value = promptData[key];
        const isEmpty = !value || value === 'non communiqué' || value === 'N/A' || value === '';
        
        // Cas spécial: normes_ce (normaliser et dédupliquer)
        if (key === 'normes_ce' && Array.isArray(value) && value.length > 0) {
          const normalized = value.map(normalizeStandard).filter(Boolean);
          merged.normes_ce = [...new Set([...merged.normes_ce, ...normalized])].sort();
          return;
        }
        
        // Cas spécial: historique_incidents (filtrer URLs invalides)
        if (key === 'historique_incidents' && Array.isArray(value) && value.length > 0) {
          const validIncidents = value.filter((inc: any) => 
            inc.source && inc.source.startsWith('http')
          );
          merged.historique_incidents = [...merged.historique_incidents, ...validIncidents];
          return;
        }
        
        // Cas spécial: documents_conformite (valider PDFs)
        if (key === 'documents_conformite' && typeof value === 'object') {
          Object.keys(value).forEach(docKey => {
            const docUrl = value[docKey];
            if (docUrl && docUrl !== 'non communiqué' && isPdf(docUrl)) {
              merged.documents_conformite[docKey] = docUrl;
            }
          });
          return;
        }
        
        // Cas spécial: notice_pdf (valider PDF)
        if (key === 'notice_pdf' && value && value !== 'non communiqué') {
          if (isPdf(value)) {
            merged.notice_pdf = value;
          }
          return;
        }
        
        // Cas spécial: pays_origine (forcer ISO-2)
        if (key === 'pays_origine' && value && value !== 'non communiqué') {
          const upper = value.toUpperCase().trim();
          if (/^[A-Z]{2}$/.test(upper)) {
            merged.pays_origine = upper;
          }
          return;
        }
        
        // Cas spécial: langues_disponibles (merge arrays, codes ISO-2)
        if (key === 'langues_disponibles' && Array.isArray(value) && value.length > 0) {
          const validLangs = value.filter((lang: string) => /^[a-z]{2}$/.test(lang.toLowerCase()));
          merged.langues_disponibles = [...new Set([...merged.langues_disponibles, ...validLangs.map((l: string) => l.toLowerCase())])];
          return;
        }
        
        // Cas spécial: avertissements (merge arrays)
        if (key === 'avertissements' && Array.isArray(value) && value.length > 0) {
          merged.avertissements = [...new Set([...merged.avertissements, ...value])];
          return;
        }
        
        // Cas spécial: compatibilites (merge arrays)
        if (key === 'compatibilites' && Array.isArray(value) && value.length > 0) {
          merged.compatibilites = [...new Set([...merged.compatibilites, ...value])];
          return;
        }
        
        // Règle générale: ne pas écraser si déjà rempli, sauf si nouvelle valeur plus riche
        if (!isEmpty) {
          if (!merged[key] || merged[key] === 'non communiqué' || merged[key] === 'N/A') {
            merged[key] = value;
          }
        }
      });

      // Collecter les sources_urls des prompts
      if (promptData.sources_urls && Array.isArray(promptData.sources_urls)) {
        usedSources.push(...promptData.sources_urls);
      }
      
      console.log(`[RSGP] ✅ Prompt ${index+1} (${sectionName}) intégré (confiance: ${sectionConfidence[sectionName].toFixed(2)})`);
    } else {
      const sectionName = promptNames[index];
      sectionConfidence[sectionName] = 0;
      console.warn(`[RSGP] ⚠️ Prompt ${index+1} (${sectionName}) échoué`);
    }
  });

  // ✅ Dédupliquer sources
  const uniqueSources = [...new Set(usedSources)].filter(url => url.startsWith('http'));
  
  // ✅ Séparer sources trusted vs non-trusted
  const trustedSources = uniqueSources.filter(isTrustedDomain);
  const otherSources = uniqueSources.filter(url => !isTrustedDomain(url));

  // ✅ Métadonnées enrichies avec confiance et sources vérifiées
  merged.generation_metadata = {
    method: webSearchData.searchMethod,
    timestamp: new Date().toISOString(),
    web_results_count: webSearchData.searchResults.length,
    sources_urls: uniqueSources,
    trusted_sources: trustedSources,
    other_sources: otherSources,
    queries_executed: [...new Set(webSearchData.searchResults.map((r: any) => r.query))],
    section_confidence: sectionConfidence,
    overall_confidence: Object.values(sectionConfidence).reduce((a, b) => a + b, 0) / Math.max(Object.keys(sectionConfidence).length, 1)
  };

  console.log('[RSGP] ✅ Merge terminé:', {
    nom_produit: merged.nom_produit,
    fabricant_nom: merged.fabricant_nom,
    normes_ce_count: merged.normes_ce?.length || 0,
    has_certificat_ce: !!merged.documents_conformite?.certificat_ce,
    confidence_score: merged.generation_metadata?.overall_confidence
  });

  // ✅ Filtrer strictement selon whitelist
  return pickWhitelist(merged, RSGP_ALLOWED_COLUMNS);
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
  
  const derivedData = {
    ean: result.ean || null,
    brand: result.brand || result.manufacturer || null,
    numero_modele: result.model || result.model_number || null,
    garantie: result.warranty || result.warranty_info || null,
    categorie_rsgp: result.category || result.product_category || null,
    fournisseur: result.seller || result.supplier || null,
  };
  
  console.log('[RSGP] 🔄 Données dérivées de l\'analyse:', {
    ean: derivedData.ean || '❌ Manquant',
    brand: derivedData.brand || '❌ Manquant',
    numero_modele: derivedData.numero_modele || '❌ Manquant',
    categorie_rsgp: derivedData.categorie_rsgp || '❌ Manquant'
  });
  
  return derivedData;
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

    console.log('[RSGP] 🚀 === DÉBUT GÉNÉRATION RSGP ===');
    console.log('[RSGP] 📋 Configuration:');
    console.log(`  - Analysis ID: ${analysis_id}`);
    console.log(`  - User ID: ${user.id}`);
    console.log(`  - Force regenerate: ${force_regenerate}`);
    console.log('[RSGP] 🔑 Clés API disponibles:');
    console.log(`  - LOVABLE_API_KEY: ${Deno.env.get('LOVABLE_API_KEY') ? '✅ Présente' : '❌ Manquante'}`);
    console.log(`  - SERPER_API_KEY: ${Deno.env.get('SERPER_API_KEY') ? '✅ Présente' : '❌ Manquante'}`);

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

    console.log('[RSGP] 📊 Analyse récupérée:', {
      id: analysis.id,
      product_name: analysis.product_name,
      hasAnalysisResult: !!analysis.analysis_result,
      analysisResultKeys: analysis.analysis_result ? Object.keys(analysis.analysis_result) : []
    });

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
    
    // ========== PHASE 2.5: Recherche et récupération FCC ID (si électronique) ==========
    let fccId = null;
    let fccData = null;
    
    const isElectronic = derivedData.categorie_rsgp === 'électronique' || 
                        rsgpData.categorie_rsgp === 'électronique' ||
                        derivedData.categorie_rsgp === 'autre' ||
                        rsgpData.categorie_rsgp === 'autre';
    
    if (isElectronic) {
      console.log('[FCC] 🔍 Produit électronique détecté, recherche FCC ID...');
      fccId = await searchFCCId(
        productName, 
        derivedData.brand || 'unknown', 
        derivedData.numero_modele || ''
      );
      
      if (fccId) {
        console.log(`[FCC] ✅ FCC ID trouvé: ${fccId}, récupération des données...`);
        fccData = await fetchFCCData(fccId);
        
        if (fccData) {
          console.log('[FCC] ✅ Données FCC récupérées avec succès');
        }
      } else {
        console.log('[FCC] ℹ️ Aucun FCC ID trouvé pour ce produit');
      }
    } else {
      console.log('[FCC] ℹ️ Produit non électronique, recherche FCC ignorée');
    }
    
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
      
      // ✅ FCC certification data
      fcc_id: fccId,
      fcc_data: fccData,
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

    // ✅ Filtrer selon whitelist avant upsert
    const finalPayload = pickWhitelist(sanitizedData, RSGP_ALLOWED_COLUMNS);

    console.log('[RSGP] 💾 === SAUVEGARDE EN BASE ===');
    console.log('[RSGP] 📝 Données à sauvegarder:', {
      analysis_id,
      user_id: user.id,
      nom_produit: finalPayload.nom_produit,
      fabricant_nom: finalPayload.fabricant_nom,
      normes_ce_count: finalPayload.normes_ce?.length || 0,
      has_documents: !!finalPayload.documents_conformite,
      validation_status: 'draft'
    });

    // Save to database using UPSERT
    const { data: complianceRecord, error: insertError } = await supabase
      .from('rsgp_compliance')
      .upsert({
        analysis_id,
        user_id: user.id,
        ...finalPayload,
        validation_status: 'draft'
      }, {
        onConflict: 'analysis_id'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[RSGP] ❌ Erreur base de données:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details
      });
      throw insertError;
    }

    console.log('[RSGP] ✅ Sauvegarde réussie:', {
      id: complianceRecord.id,
      analysis_id: complianceRecord.analysis_id
    });

    // Update product_analyses
    await supabase
      .from('product_analyses')
      .update({
        rsgp_compliance: finalPayload,  // ✅ Sauvegarde dans la colonne dédiée
        rsgp_compliance_id: complianceRecord.id,  // ✅ + référence à la table séparée
        enrichment_status: {
          ...(analysis.enrichment_status || {}),
          rsgp: 'completed'
        }
      })
      .eq('id', analysis_id);

    console.log('[RSGP] 🎉 === FIN GÉNÉRATION RSGP ===');
    console.log('[RSGP] 📊 Résumé:', {
      success: true,
      method: rsgpData.generation_metadata?.method,
      webSearchMethod: rsgpData.generation_metadata?.web_search_method,
      webResultsCount: rsgpData.generation_metadata?.web_results_count,
      sourcesCount: rsgpData.generation_metadata?.sources_urls?.length || 0,
      overallConfidence: rsgpData.generation_metadata?.overall_confidence,
      hasRealData: rsgpData.fabricant_nom !== 'non communiqué'
    });

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