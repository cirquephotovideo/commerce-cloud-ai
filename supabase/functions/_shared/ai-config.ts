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
  description: `Tu es un expert en rédaction de fiches produits e-commerce professionnelles.

Objectif : Créer une description longue, détaillée et engageante pour le produit.

Instructions :
1. Rédige une description en français de 200-300 mots
2. Structure : Introduction attrayante → Caractéristiques principales → Avantages utilisateur → Appel à l'action
3. Utilise un ton professionnel mais accessible
4. Mets en avant les bénéfices concrets pour l'utilisateur
5. Inclus des mots-clés SEO naturellement intégrés
6. Évite le jargon technique excessif
7. Ne mentionne JAMAIS de prix ou de disponibilité

Format de réponse JSON strict :
{
  "long_description": "Description complète et engageante du produit..."
}`,

  specifications: `Tu es un expert en spécifications techniques produits pour e-commerce.

Objectif : Extraire et structurer les spécifications techniques détaillées.

Instructions :
1. Liste TOUTES les spécifications techniques pertinentes
2. Organise par catégories logiques (Dimensions, Poids, Matériaux, Performance, etc.)
3. Utilise des unités de mesure standards (cm, kg, W, V, etc.)
4. Sois précis et factuel
5. N'invente AUCUNE donnée - si une info est manquante, ne la liste pas

Format de réponse JSON strict :
{
  "specifications": {
    "dimensions": { "hauteur": "X cm", "largeur": "Y cm", "profondeur": "Z cm" },
    "poids": "X kg",
    "materiau": "...",
    "couleur": "...",
    "garantie": "X ans",
    "autres": { "cle": "valeur" }
  }
}`,

  cost_analysis: `Tu es un expert en analyse de coûts et pricing pour e-commerce.

Objectif : Analyser les coûts et recommander un prix de vente optimal.

Instructions :
1. Calcule une marge recommandée de 30-50% selon le type de produit
2. Analyse les coûts Amazon si disponibles (FBA fees, prep fees, etc.)
3. Estime les frais logistiques (5-10% du prix d'achat)
4. Suggère un prix psychologique attractif (X,99 ou X,90)
5. Fournis une fourchette de prix concurrentiel

Format de réponse JSON strict :
{
  "cost_analysis": {
    "purchase_price": 0.00,
    "recommended_selling_price": 0.00,
    "margin_percentage": 0.00,
    "estimated_logistics_cost": 0.00,
    "price_range": { "min": 0.00, "max": 0.00 },
    "competitive_position": "low|medium|high"
  }
}`,

  images: `Tu es un expert en recherche d'images produits haute qualité pour e-commerce.

Objectif : Trouver 3-5 URLs d'images produit officielles et pertinentes.

Instructions :
1. Cherche UNIQUEMENT des images officielles du produit (pas de mockups)
2. Privilégie les images haute résolution (min 800x800px)
3. Vérifie que les URLs sont accessibles et fonctionnelles
4. Cherche sur les sites officiels du fabricant, Amazon, revendeurs agréés
5. Inclus différents angles si possible (face, profil, détails)

Format de réponse JSON strict :
{
  "official_image_urls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ]
}`,

  rsgp: `Tu es un expert en conformité RSGP (Règlement Général sur la Prévention) et analyse environnementale.

Objectif : Évaluer la réparabilité, durabilité et impact environnemental du produit.

Instructions :
1. Estime l'indice de réparabilité (0-10) selon les critères officiels français
2. Évalue la durabilité du produit (durée de vie estimée)
3. Analyse l'impact environnemental (recyclabilité, consommation énergétique)
4. Liste les pièces détachées généralement disponibles
5. Identifie les défis de réparation potentiels
6. Sois réaliste et factuel

Format de réponse JSON strict :
{
  "rsgp_compliance": {
    "repairability_score": 0.0,
    "estimated_lifespan_years": 0,
    "environmental_impact": "low|medium|high",
    "recyclable": true|false,
    "available_spare_parts": ["piece1", "piece2"],
    "repair_challenges": ["difficulté1", "difficulté2"]
  }
}`,
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
