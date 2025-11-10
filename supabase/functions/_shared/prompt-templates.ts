/**
 * Centralized prompt templates for product analysis and enrichment
 * All prompts are structured to ensure complete, detailed, and actionable results
 */

export const PromptTemplates = {
  /**
   * Initial product analysis - Most comprehensive prompt
   */
  initialAnalysis: (
    productInfo: string,
    inputType: string,
    categories: any[],
    additionalData?: any
  ) => {
    return `Tu es un expert en catalogage produit e-commerce avec 15 ans d'expérience. Tu vas analyser ce produit de manière EXHAUSTIVE.

🎯 **CONTEXTE ET OBJECTIF**
Nous devons créer une fiche produit complète pour notre plateforme e-commerce. Chaque section est CRUCIALE pour :
- Le référencement SEO (titre, meta description, mots-clés)
- La conversion client (description marketing, avantages compétitifs)
- La gestion commerciale (analyse de coûts, positionnement prix)
- La conformité réglementaire (codes douaniers, certifications)
- L'expérience client (spécifications techniques, réparabilité)

📦 **PRODUIT À ANALYSER**
Type d'entrée: ${inputType}
${inputType === 'url' ? `URL du produit: ${productInfo}\n→ Scrape la page, analyse les images, lis les avis clients` : 
  inputType === 'barcode' ? `Code-barres: ${productInfo}\n→ Recherche dans les bases de données produits internationales (EAN, UPC)` : 
  `Nom du produit: ${productInfo}\n→ Effectue des recherches web approfondies sur Google, sites e-commerce, avis clients`}

${additionalData ? `
🔍 **DONNÉES FOURNISSEUR EXISTANTES** (à enrichir, pas à recopier) :
- Description: ${additionalData.description || 'Aucune'}
- EAN: ${additionalData.ean || 'Aucun'}
- Marque: ${additionalData.brand || 'Inconnue'}
- Catégorie: ${additionalData.category || 'Non spécifiée'}
- Prix d'achat: ${additionalData.purchase_price || 'Non renseigné'} ${additionalData.currency || ''}
- Référence fournisseur: ${additionalData.supplier_reference || 'Aucune'}
` : ''}

${categories.length > 0 ? `
📂 **CATÉGORIES ODOO DISPONIBLES**
${categories.map((c: any) => `- ${c.full_path} (ID: ${c.odoo_category_id})`).join('\n')}
→ Choisis la catégorie la PLUS SPÉCIFIQUE possible
` : ''}

---

⚠️ **INSTRUCTIONS CRITIQUES** ⚠️

1. **RECHERCHE WEB OBLIGATOIRE**
   - Consulte au minimum 5 sources différentes (sites officiels, e-commerce, avis)
   - Note TOUTES les URLs consultées dans un champ "web_sources"
   - Vérifie les informations sur plusieurs sites
   - Privilégie les données officielles (site du fabricant, fiches techniques)

2. **EXHAUSTIVITÉ**
   - TOUS les champs doivent être remplis
   - Si une information est introuvable après recherche approfondie : utilise "N/A" et explique pourquoi dans un champ "_research_notes"
   - Si tu estimes/déduis une valeur, ajoute "(estimé)" et explique ton raisonnement

3. **QUALITÉ DES CONTENUS**
   - description_long : 600-1000 mots, style marketing persuasif, structure en 3-4 paragraphes
   - Inclus des chiffres, des données techniques, des comparaisons
   - Réponds aux questions : Pourquoi acheter ce produit ? Pour qui ? Quels bénéfices ?
   - recommendations : 2-3 actions concrètes et actionnables par section

4. **PRÉCISION TECHNIQUE**
   - Spécifications : dimensions exactes, poids, matériaux, certifications
   - Prix : fourchette de prix marché avec min/max
   - HS Code : 8 chiffres minimum, vérifie la nomenclature douanière
   - Réparabilité : score basé sur des critères objectifs

---

📋 **FORMAT JSON EXACT REQUIS**

{
  "product_name": "Nom commercial complet et précis du produit",
  "brand": "Marque officielle",
  "model_reference": "Référence modèle constructeur",
  "ean_code": "Code-barres EAN si trouvé",
  
  "description": "Phrase d'accroche courte (50-80 caractères) qui donne envie",
  
  "description_long": "Description marketing de 600-1000 mots structurée ainsi : Paragraphe 1 (Hook) présentation percutante du produit et de son bénéfice principal. Paragraphe 2 (Caractéristiques) détails techniques et fonctionnalités clés avec chiffres. Paragraphe 3 (Avantages) bénéfices concrets pour l'utilisateur, cas d'usage. Paragraphe 4 (Différenciation) ce qui rend ce produit unique vs concurrence.",
  
  "seo": {
    "score": 85,
    "title": "Titre SEO optimisé 60-70 caractères avec mot-clé principal",
    "meta_description": "Meta description 150-160 caractères incitative avec appel à l'action",
    "keywords": ["mot-clé principal", "mot-clé secondaire 1", "mot-clé secondaire 2", "mot-clé longue traîne 1"],
    "h1_suggestion": "Titre H1 pour la page produit",
    "url_slug": "url-optimisee-du-produit",
    "recommendations": ["Recommandation SEO spécifique 1 avec métrique d'impact", "Recommandation SEO spécifique 2"]
  },
  
  "pricing": {
    "estimated_price": "Prix de vente moyen constaté en EUR",
    "price_range": {
      "min": "Prix minimum trouvé",
      "max": "Prix maximum trouvé",
      "currency": "EUR"
    },
    "market_position": "Budget/Milieu de gamme/Premium/Luxe",
    "competitive_analysis": "Analyse détaillée du positionnement prix vs concurrence avec exemples de concurrents directs et leurs prix",
    "recommended_margin": "Marge recommandée en % basée sur le secteur",
    "recommendations": ["Recommandation pricing 1 avec justification", "Recommandation pricing 2"]
  },
  
  "competition": {
    "main_competitors": [
      {"name": "Concurrent 1", "product": "Modèle concurrent", "price": "Prix", "main_difference": "Différence clé"}
    ],
    "market_share": "Part de marché estimée du fabricant avec source",
    "differentiation": "Points de différenciation CONCRETS de ce produit vs concurrence",
    "recommendations": ["Comment mieux valoriser les avantages", "Comment atténuer les inconvénients"]
  },
  
  "competitive_pros": ["Avantage concurrentiel 1 avec preuve", "Avantage 2", "Avantage 3"],
  "competitive_cons": ["Inconvénient 1 face à la concurrence", "Inconvénient 2"],
  
  "use_cases": [
    "Professionnel : Cas d'usage détaillé avec exemple concret",
    "Particulier : Cas d'usage détaillé avec exemple concret",
    "Entreprise : Cas d'usage détaillé avec exemple concret"
  ],
  
  "market_position": "leader/challenger/suiveur/niche - Analyse du positionnement",
  
  "trends": {
    "market_trend": "Croissance forte/Croissance modérée/Stable/Déclin",
    "popularity_score": 75,
    "seasonal_factors": "Analyse des mois/périodes favorables et pourquoi",
    "future_outlook": "Perspectives d'évolution du marché sur 2-3 ans",
    "recommendations": ["Action marketing basée sur tendances", "Adaptation produit future"]
  },
  
  "description": {
    "current_quality": "Évaluation 0-10 de la description actuelle",
    "suggested_description": "Proposition de description améliorée en 2-3 paragraphes",
    "key_features": ["Caractéristique 1 avec bénéfice", "Caractéristique 2", "Caractéristique 3"],
    "target_audience": "Description précise de la cible",
    "recommendations": ["Amélioration rédactionnelle 1", "Amélioration 2"]
  },
  
  "repairability": {
    "score": 7.5,
    "ease_of_repair": "facile/moyen/difficile",
    "spare_parts_availability": "excellente/bonne/moyenne/limitée",
    "durability_score": 8.0,
    "repairability_index": "Index officiel si disponible",
    "recommendations": ["Action pour améliorer perception réparabilité", "Service à mettre en avant"]
  },
  
  "hs_code": {
    "code": "12345678",
    "description": "Description précise de la catégorie douanière",
    "tariff_info": "Droits de douane applicables"
  },
  
  "environmental_impact": {
    "carbon_footprint": "Estimation CO2 si disponible",
    "recyclability_score": 7.5,
    "eco_certifications": ["Energy Star", "EPEAT Gold"],
    "energy_efficiency": "Classe énergétique",
    "eco_score": 8.0,
    "recommendations": ["Action pour réduire impact", "Argument écologique à valoriser"]
  },
  
  "image_optimization": {
    "quality_score": 80,
    "suggested_angles": ["Front", "Side", "Top", "Detail", "In context"],
    "background_recommendations": "Fond blanc pur pour vues produit",
    "lighting_suggestions": "Lumière douce et diffuse, 3-point lighting",
    "composition_tips": "Règle des tiers, espace négatif",
    "recommended_colors": ["#FFFFFF", "#F5F5F5", "#000000"],
    "photography_style": "Packshot/Lifestyle/Editorial",
    "technical_specs": {
      "min_resolution": "2000x2000px",
      "recommended_format": "JPEG pour photos",
      "compression_level": "80-85%"
    },
    "ai_generation_prompts": [
      "Prompt détaillé 1 pour génération d'image",
      "Prompt détaillé 2 pour image lifestyle"
    ],
    "recommendations": ["Priorité image 1 avec justification", "Priorité image 2"]
  },
  
  "tags_categories": {
    "primary_category": "Catégorie e-commerce principale",
    "subcategories": ["Sous-catégorie 1", "Sous-catégorie 2"],
    "suggested_tags": ["tag-principal", "tag-marque", "tag-caracteristique"],
    "odoo_category_id": ${categories.length > 0 ? 'ID de la catégorie Odoo la PLUS SPÉCIFIQUE' : 'null'},
    "odoo_category_name": "${categories.length > 0 ? 'Nom complet de la catégorie Odoo choisie' : 'null'}",
    "recommendations": ["Amélioration catégorisation", "Tags additionnels"]
  },
  
  "customer_reviews": {
    "sentiment_score": 4.2,
    "common_praises": ["Point positif 1 avec fréquence", "Point positif 2"],
    "common_complaints": ["Point négatif 1 avec fréquence", "Point négatif 2"],
    "recommendations": ["Comment adresser plaintes dans fiche produit", "Points positifs à valoriser"]
  },
  
  "global_report": {
    "overall_score": 82,
    "strengths": ["Force 1 avec impact business", "Force 2", "Force 3"],
    "weaknesses": ["Faiblesse 1 avec impact", "Faiblesse 2"],
    "priority_actions": [
      "Action prioritaire 1 avec ROI et délai",
      "Action prioritaire 2 avec ROI et délai"
    ],
    "estimated_optimization_impact": "Impact chiffré de l'optimisation"
  },
  
  "web_sources": [
    "https://source1.com - Type d'information trouvée",
    "https://source2.com - Type d'information trouvée",
    "https://source3.com - Type d'information trouvée"
  ],
  
  "_research_notes": "Notes sur la recherche, difficultés rencontrées, données estimées",
  "_confidence_level": {
    "overall": "high/medium/low",
    "by_section": {
      "specifications": "high/medium/low avec justification",
      "pricing": "high/medium/low avec justification"
    }
  }
}

⚠️ **RAPPEL FINAL**
- Retourne UNIQUEMENT le JSON, aucun texte avant ou après
- Tous les champs doivent être remplis (utilise "N/A" + explication si introuvable)
- Privilégie TOUJOURS les données réelles aux estimations
- Note toutes tes sources pour traçabilité
- Structure: JSON valide, pas de commentaires`;
  },

  /**
   * Specifications enrichment prompt
   */
  specifications: (productData: any, existingData?: any) => {
    return `Tu es un ingénieur produit expert. Fournis des spécifications techniques EXHAUSTIVES.

PRODUIT : ${productData.product_name || productData.name}
MARQUE : ${productData.brand || 'Inconnue'}
CATÉGORIE : ${productData.category || 'Non spécifiée'}

${existingData ? `
DONNÉES EXISTANTES (à enrichir) :
${JSON.stringify(existingData, null, 2)}
` : ''}

🎯 OBJECTIF :
Créer une fiche technique complète qui répond à TOUTES les questions techniques d'un acheteur professionnel.

📋 SOURCES À CONSULTER :
1. Site officiel du fabricant (section spécifications)
2. Manuels utilisateur (PDF si disponibles)
3. Fiches techniques distributeurs
4. Tests professionnels (01net, Les Numériques, etc.)
5. Forums techniques et communautés d'utilisateurs

⚠️ INSTRUCTIONS :
- Chaque mesure DOIT avoir son unité
- Si une valeur est estimée, ajoute "(estimé)"
- Pour chaque certification, vérifie qu'elle existe réellement
- Distingue matériaux principaux et secondaires

JSON REQUIS :
{
  "dimensions": {
    "length": { "value": 0, "unit": "mm", "tolerance": "±2mm" },
    "width": { "value": 0, "unit": "mm", "tolerance": "±2mm" },
    "height": { "value": 0, "unit": "mm", "tolerance": "±2mm" },
    "weight": { "value": 0, "unit": "g", "tolerance": "±5g" }
  },
  "materials": [
    {
      "name": "Nom du matériau",
      "percentage": 70,
      "properties": "Propriétés",
      "certifications": ["Cert 1"]
    }
  ],
  "certifications": [
    {
      "name": "CE",
      "number": "Numéro",
      "issuing_body": "Organisme",
      "scope": "Périmètre"
    }
  ],
  "technical_details": {
    "operating_temperature": { "min": -10, "max": 40, "unit": "°C" },
    "power_requirements": {
      "voltage": "230V",
      "frequency": "50Hz",
      "power_consumption": { "idle": 5, "max": 100, "unit": "W" }
    },
    "connectivity": ["USB-C", "Bluetooth 5.2"],
    "included_accessories": ["Accessoire 1", "Accessoire 2"]
  },
  "warranty": {
    "duration": "2 ans",
    "type": "Garantie constructeur",
    "coverage": "Ce qui est couvert"
  },
  "origin": {
    "country_of_manufacture": "Pays de fabrication"
  },
  "data_sources": ["URL 1", "URL 2"],
  "confidence_level": "high/medium/low",
  "research_notes": "Notes sur données trouvées/estimées"
}

Retourne UNIQUEMENT le JSON.`;
  },

  /**
   * Cost analysis enrichment prompt
   */
  costAnalysis: (productData: any, purchasePrice?: number, marketData?: any) => {
    return `Tu es un analyste financier spécialisé en pricing e-commerce. Fournis une analyse de coûts DÉTAILLÉE.

PRODUIT : ${productData.product_name || productData.name}
PRIX D'ACHAT : ${purchasePrice || 'Non renseigné'} EUR
CATÉGORIE : ${productData.category || 'Non spécifiée'}

${marketData ? `
DONNÉES MARCHÉ EXISTANTES :
${JSON.stringify(marketData, null, 2)}
` : ''}

🎯 OBJECTIF :
Déterminer le prix de vente optimal qui maximise le profit tout en restant compétitif.

📊 ANALYSE REQUISE :
1. **Benchmarking prix marché** : Consulte 10-15 e-commerçants
2. **Analyse des coûts cachés** : Logistique, SAV, retours
3. **Élasticité prix** : Sensibilité de la demande

JSON REQUIS :
{
  "market_research": {
    "competitor_prices": [
      {
        "seller": "Amazon",
        "url": "URL",
        "price": 99.99,
        "delivery_cost": 5.99,
        "in_stock": true
      }
    ],
    "price_statistics": {
      "min": 85.00,
      "max": 129.99,
      "average": 102.50,
      "median": 99.99
    }
  },
  "cost_breakdown": {
    "purchase_price": ${purchasePrice || 0},
    "logistics": {
      "total_logistics": "Coût total logistique estimé"
    },
    "total_cost": "Somme de tous les coûts"
  },
  "margin_analysis": {
    "industry_standard_margin": "Marge standard secteur %",
    "recommended_margin": "Marge recommandée % avec justification",
    "minimum_viable_margin": "Marge minimum"
  },
  "pricing_strategy": {
    "recommended_price": 119.99,
    "price_positioning": "Positionnement vs marché",
    "profit_per_unit": "Profit par unité",
    "breakeven_volume": "Volume breakeven"
  },
  "pricing_scenarios": [
    {
      "scenario": "Pénétration marché",
      "price": 89.99,
      "margin": 15,
      "pros": ["Avantage 1"],
      "cons": ["Inconvénient 1"]
    }
  ],
  "recommendations": [
    "Recommandation 1 avec impact chiffré",
    "Recommandation 2"
  ],
  "data_sources": ["Source 1", "Source 2"],
  "confidence_level": "high/medium/low"
}

Retourne UNIQUEMENT le JSON.`;
  },

  /**
   * Long description enrichment prompt
   */
  longDescription: (productData: any, seoKeywords?: string[], targetAudience?: string) => {
    return `Tu es un rédacteur marketing expert en e-commerce. Crée une description longue PERSUASIVE et OPTIMISÉE SEO.

PRODUIT : ${productData.product_name || productData.name}
MARQUE : ${productData.brand || 'Inconnue'}
DESCRIPTION COURTE EXISTANTE : ${productData.description || 'Aucune'}

${seoKeywords && seoKeywords.length > 0 ? `
MOTS-CLÉS SEO À INTÉGRER : ${seoKeywords.join(', ')}
` : ''}

${targetAudience ? `
AUDIENCE CIBLE : ${targetAudience}
` : ''}

🎯 OBJECTIF :
Créer une description de 600-1000 mots qui CONVERTIT les visiteurs en acheteurs.

📝 STRUCTURE REQUISE :

**Paragraphe 1 (Hook - 150 mots)** :
- Commencer par le bénéfice principal
- Créer un sentiment d'urgence ou de désir
- Interpeller l'audience cible

**Paragraphe 2 (Caractéristiques - 250 mots)** :
- Détailler les spécifications techniques
- Utiliser des chiffres et données concrètes
- Expliquer les fonctionnalités clés

**Paragraphe 3 (Avantages - 200 mots)** :
- Transformer les caractéristiques en bénéfices
- Donner des exemples d'utilisation
- Répondre aux objections potentielles

**Paragraphe 4 (Différenciation - 150 mots)** :
- Expliquer ce qui rend ce produit unique
- Comparer subtilement avec la concurrence
- Call-to-action final

⚠️ RÈGLES D'ÉCRITURE :
- Ton : ${targetAudience?.includes('professionnel') ? 'Professionnel et technique' : 'Engageant et accessible'}
- Intégrer naturellement les mots-clés SEO
- Utiliser des listes à puces pour la lisibilité
- Éviter le jargon sauf si audience technique
- Inclure des données chiffrées (performances, économies, etc.)

JSON REQUIS :
{
  "description_long": "Texte complet de 600-1000 mots avec les 4 paragraphes",
  "word_count": 750,
  "readability_score": "Score Flesch-Kincaid si calculable",
  "seo_keywords_density": {
    "mot-clé-1": "2.5%",
    "mot-clé-2": "1.8%"
  },
  "key_selling_points": [
    "Point de vente 1 extrait de la description",
    "Point de vente 2",
    "Point de vente 3"
  ],
  "recommendations": [
    "Suggestion d'amélioration 1",
    "Suggestion d'amélioration 2"
  ]
}

Retourne UNIQUEMENT le JSON.`;
  },

  /**
   * SEO optimization prompt
   */
  seoOptimization: (productData: any, competitors?: any[]) => {
    return `Tu es un expert SEO spécialisé en e-commerce. Optimise TOUS les éléments SEO de cette fiche produit.

PRODUIT : ${productData.product_name || productData.name}
DESCRIPTION : ${productData.description || 'Aucune'}

${competitors && competitors.length > 0 ? `
CONCURRENTS IDENTIFIÉS :
${competitors.map((c: any) => `- ${c.name}: ${c.product}`).join('\n')}
` : ''}

🎯 OBJECTIF :
Maximiser le ranking Google et le CTR pour ce produit.

📊 ANALYSE REQUISE :
1. Recherche de mots-clés (volume, difficulté, intention)
2. Analyse des SERPs concurrentes
3. Optimisation pour Google Shopping
4. Rich snippets / Schema.org

⚠️ RÈGLES SEO :
- Titre : 60-70 caractères, mot-clé principal au début
- Meta description : 150-160 caractères, incitative, avec CTA
- Mots-clés : mix de head terms + long tail
- URL slug : courte, descriptive, avec tirets

JSON REQUIS :
{
  "score": 85,
  "title": "Titre SEO optimisé avec mot-clé principal",
  "meta_description": "Meta description persuasive avec appel à l'action",
  "keywords": [
    {
      "keyword": "mot-clé principal",
      "search_volume": "Volume mensuel estimé",
      "difficulty": "low/medium/high",
      "intent": "informational/commercial/transactional"
    }
  ],
  "h1_suggestion": "Titre H1 pour la page",
  "h2_suggestions": ["Sous-titre H2 recommandé 1", "Sous-titre H2 recommandé 2"],
  "url_slug": "url-optimisee-produit",
  "schema_markup": {
    "type": "Product",
    "required_fields": ["name", "image", "description", "sku", "offers"]
  },
  "internal_linking_suggestions": [
    "Lien vers catégorie parent",
    "Lien vers produits complémentaires"
  ],
  "competitive_keywords": [
    "Mot-clé utilisé par concurrent 1",
    "Mot-clé utilisé par concurrent 2"
  ],
  "recommendations": [
    "Recommandation SEO prioritaire 1 avec impact estimé",
    "Recommandation SEO prioritaire 2"
  ],
  "estimated_traffic_potential": "Trafic organique mensuel potentiel"
}

Retourne UNIQUEMENT le JSON.`;
  }
};
