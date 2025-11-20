/**
 * Configuration centralisée pour tous les enrichissements IA
 * Utilisez ce fichier pour changer de modèle ou de provider pour TOUS les enrichissements
 */

export const AI_CONFIG = {
  provider: 'lovable', // 'lovable' | 'ollama' | 'openai'
  model: 'google/gemini-2.5-flash',
  temperature: 0.3,
  max_tokens: 4000,
  retry_attempts: 3,
  timeout: 60000, // 60 secondes
};

export const LOVABLE_API_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

/**
 * Prompts unifiés optimisés pour chaque type d'enrichissement
 */
export const UNIFIED_PROMPTS = {
  description: `Tu es un expert en rédaction de fiches produits e-commerce.

CONTEXTE : Les données ci-dessous proviennent d'une recherche web sur le produit.

INSTRUCTION : Génère une description longue et détaillée (200-300 mots) en français, optimisée SEO.

IMPORTANT : Réponds UNIQUEMENT en JSON avec cette structure exacte :
{
  "long_description": "Description complète et engageante du produit...",
  "web_sources": ["url1", "url2"],
  "confidence_level": "high"
}`,

  specifications: `Tu es un expert en spécifications techniques e-commerce.

CONTEXTE : Données produit issues d'une recherche web.

INSTRUCTION : Extrais TOUTES les spécifications techniques pertinentes.

IMPORTANT : Réponds UNIQUEMENT en JSON avec cette structure :
{
  "specifications": {
    "Dimensions": "...",
    "Poids": "...",
    "Matériaux": "...",
    "Couleur": "...",
    "Garantie": "..."
  },
  "web_sources": ["url1", "url2"],
  "confidence_level": "high"
}`,

  cost_analysis: `Tu es un expert en analyse de coûts et pricing e-commerce.

CONTEXTE : Données produit + prix d'achat fourni.

INSTRUCTION : Calcule un prix de vente recommandé avec marge réaliste (25-40%).

IMPORTANT : Réponds UNIQUEMENT en JSON avec cette structure :
{
  "cost_analysis": {
    "recommended_selling_price": 99.99,
    "margin_percentage": 35,
    "competitor_price_range": "80-120 EUR",
    "justification": "Explication de la stratégie pricing..."
  },
  "web_sources": ["url1", "url2"],
  "confidence_level": "high"
}`,

  images: `Tu es un expert en recherche d'images produits officielles.

CONTEXTE : Informations produit fournies.

INSTRUCTION : Trouve 3-5 URLs d'images haute qualité (officielles ou professionnelles).

IMPORTANT : Réponds UNIQUEMENT en JSON avec cette structure :
{
  "official_image_urls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "web_sources": ["source1", "source2"],
  "confidence_level": "high"
}`,

  rsgp: `Tu es un expert en conformité RSGP et impact environnemental.

CONTEXTE : Données produit fournies.

INSTRUCTION : Évalue la réparabilité ET l'impact environnemental du produit.

IMPORTANT : Réponds UNIQUEMENT en JSON avec cette structure COMPLÈTE :
{
  "rsgp_compliance": {
    "repairability_score": 7.5,
    "compliance_level": "compliant",
    "documentation_available": true,
    "repair_guide_url": "https://...",
    "spare_parts_availability": "Disponible sous 2 semaines",
    "durability_years": "5-7 ans"
  },
  "repairability": {
    "score": 7.5,
    "ease": "Démontage facile avec outils standards",
    "spareParts": "Disponible sous 2 semaines",
    "durability": "5-7 ans"
  },
  "environmental_impact": {
    "eco_score": 75,
    "carbon_footprint": "12kg CO2eq",
    "recyclability": "85% recyclable",
    "certifications": ["Energy Star", "EU Ecolabel"]
  },
  "hs_code": {
    "code": "8471.30",
    "description": "Machines automatiques de traitement de l'information portatives"
  },
  "web_sources": ["url1", "url2"],
  "confidence_level": "high"
}`
};

/**
 * Fonction helper pour appeler Lovable AI
 */
export async function callLovableAI(prompt: string, systemPrompt: string): Promise<any> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }

  const response = await fetch(LOVABLE_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: AI_CONFIG.temperature,
      max_completion_tokens: AI_CONFIG.max_tokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lovable AI error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Parse JSON response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in AI response');
  }

  return JSON.parse(jsonMatch[0]);
}
