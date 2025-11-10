/**
 * Système générique de prompts pour enrichissement Odoo
 * Fonctionne pour TOUS types de produits (hottes, smartphones, TV, etc.)
 */

export type AttributeCategory = 
  | 'dimension'
  | 'performance'
  | 'visual_type'
  | 'visual_color'
  | 'functionality'
  | 'components'
  | 'boolean'
  | 'label'
  | 'brand'
  | 'connectivity'
  | 'storage'
  | 'battery'
  | 'screen'
  | 'camera'
  | 'generic';

export interface AttributePromptConfig {
  category: AttributeCategory;
  searchKeywords: string[];
  promptTemplate: (attrName: string, productName: string, brand: string, allowedValues: string[], productType?: string) => string;
}

/**
 * Détecte automatiquement le type d'attribut basé sur son nom
 */
export function detectAttributeCategory(attributeName: string): AttributeCategory {
  const lowerName = attributeName.toLowerCase();
  
  // Dimensions
  if (lowerName.match(/\b(largeur|hauteur|profondeur|longueur|width|height|depth|dimension|taille|size|épaisseur|thickness|diamètre|diameter)\b/)) {
    return 'dimension';
  }
  
  // Performance (puissance, débit, vitesse, etc.)
  if (lowerName.match(/\b(débit|puissance|power|performance|vitesse|speed|capacité|capacity|autonomie|watt|hz|ghz|rpm|m³\/h|db|décibel)\b/)) {
    return 'performance';
  }
  
  // Écran (pour smartphones, TV, laptops)
  if (lowerName.match(/\b(écran|screen|display|résolution|resolution|pouces|inch|diagonal|dalle|panel|oled|lcd|amoled)\b/)) {
    return 'screen';
  }
  
  // Stockage (pour électronique)
  if (lowerName.match(/\b(stockage|storage|mémoire|memory|ram|rom|go|gb|to|tb|ssd|hdd)\b/)) {
    return 'storage';
  }
  
  // Batterie (pour électronique)
  if (lowerName.match(/\b(batterie|battery|autonomie|mah|wh|charge|charging)\b/)) {
    return 'battery';
  }
  
  // Caméra (pour smartphones)
  if (lowerName.match(/\b(caméra|camera|appareil photo|photo|mpx|megapixel|objectif|lens)\b/)) {
    return 'camera';
  }
  
  // Connectivité
  if (lowerName.match(/\b(connectivité|connectivity|wifi|wi-fi|bluetooth|nfc|5g|4g|réseau|network|app)\b/)) {
    return 'connectivity';
  }
  
  // Type de produit
  if (lowerName.match(/\b(type|catégorie|category|modèle|model)\b/)) {
    return 'visual_type';
  }
  
  // Couleur/Finition
  if (lowerName.match(/\b(couleur|color|finition|finish|teinte)\b/)) {
    return 'visual_color';
  }
  
  // Fonctionnalités
  if (lowerName.match(/\b(fonction|feature|commande|control|mode|vitesse|speed|éclairage|lighting)\b/)) {
    return 'functionality';
  }
  
  // Composants
  if (lowerName.match(/\b(filtre|filter|composant|component|accessoire|accessory)\b/)) {
    return 'components';
  }
  
  // Labels
  if (lowerName.match(/\b(classe énergétique|energy|label|certification|norme|standard)\b/)) {
    return 'label';
  }
  
  // Marque
  if (lowerName.match(/\b(marque|brand|fabricant|manufacturer)\b/)) {
    return 'brand';
  }
  
  // Boolean (Oui/Non)
  if (lowerName.match(/\b(booster|intensif|réglable|adjustable|tactile|touch)\b/)) {
    return 'boolean';
  }
  
  return 'generic';
}

/**
 * Templates de prompts par catégorie
 */
const PROMPT_TEMPLATES: Record<AttributeCategory, (attrName: string, productName: string, brand: string, allowedValues: string[], productType?: string) => string> = {
  
  dimension: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en extraction de dimensions techniques.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve la valeur EXACTE de "${attrName}"

OÙ CHERCHER:
1. Site officiel du fabricant ${brand}
2. Fiche technique PDF
3. Sites e-commerce fiables (Darty, Boulanger, Fnac, Amazon)
4. Section "Caractéristiques techniques" ou "Dimensions"

VALEURS AUTORISÉES (choisis UNIQUEMENT parmi):
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Cherche la valeur en centimètres (cm), millimètres (mm), ou pouces (")
- Pour les plages (ex: "≤ 60 cm"), choisis la plage qui CONTIENT la valeur
- Si entre deux plages, choisis la plage supérieure
- Si impossible à trouver, réponds "Non déterminé"

Réponds UNIQUEMENT avec: "N. [valeur exacte]"
Exemple: "3. 60 cm"
`,

  performance: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en analyse de performances techniques.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve la valeur de "${attrName}"

OÙ CHERCHER:
1. Fiche technique officielle (PDF)
2. Tests produits professionnels
3. Caractéristiques techniques détaillées
4. Spécifications du fabricant

VALEURS AUTORISÉES (choisis la PLAGE correspondante):
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Cherche la valeur MAXIMALE ou NOMINALE selon le contexte
- Convertis la valeur trouvée en plage correspondante
- Vérifie les unités (m³/h, dB, W, Hz, etc.)
- Si vraiment impossible, réponds "Non déterminé"

Réponds UNIQUEMENT avec: "N. [plage]"
Exemple: "2. 301–500 m³/h"
`,

  screen: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en écrans et displays.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve "${attrName}"

OÙ CHERCHER:
1. Spécifications écran du fabricant
2. Fiche technique display
3. Tests professionnels

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Pour taille: cherche en pouces (") ou cm
- Pour résolution: cherche pixels exacts (ex: 1920x1080)
- Pour type: OLED, AMOLED, LCD, IPS, etc.
- Pour taux rafraîchissement: Hz

Réponds UNIQUEMENT avec: "N. [valeur]"
`,

  storage: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en capacités de stockage.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve "${attrName}"

OÙ CHERCHER:
1. Variantes produit (64GB, 128GB, 256GB, etc.)
2. Spécifications mémoire
3. Configuration système

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- RAM: mémoire vive (8GB RAM, 16GB RAM)
- Stockage interne: ROM, SSD, HDD (128GB, 256GB, 512GB, 1TB)
- Si plusieurs variantes, prends la version de BASE
- Convertis Go/GB et To/TB correctement

Réponds UNIQUEMENT avec: "N. [capacité]"
`,

  battery: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en batteries et autonomie.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve "${attrName}"

OÙ CHERCHER:
1. Spécifications batterie (mAh, Wh)
2. Tests d'autonomie
3. Fiche technique énergie

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Capacité batterie: en mAh ou Wh
- Autonomie: en heures (h)
- Charge: temps en minutes ou heures
- Si plages, choisis celle qui correspond

Réponds UNIQUEMENT avec: "N. [valeur]"
`,

  camera: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en systèmes photo/vidéo.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve "${attrName}"

OÙ CHERCHER:
1. Spécifications caméra/photo
2. Configuration objectifs
3. Tests photo

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Résolution: en Mégapixels (MP ou MPx)
- Nombre de caméras: 1, 2, 3, 4+ objectifs
- Type: grand-angle, téléobjectif, macro, etc.
- Vidéo: 4K, 8K, FHD, etc.

Réponds UNIQUEMENT avec: "N. [valeur]"
`,

  connectivity: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en connectivité et réseaux.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve "${attrName}"

OÙ CHERCHER:
1. Spécifications réseau/connectivité
2. Caractéristiques sans-fil
3. Compatibilité app/contrôle

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Wi-Fi: cherche version (Wi-Fi 5, Wi-Fi 6, Wi-Fi 6E)
- Bluetooth: cherche version (5.0, 5.1, 5.2, 5.3)
- Réseau mobile: 4G, 5G
- App: si contrôle smartphone disponible

Réponds UNIQUEMENT avec: "N. [connectivité]"
`,

  visual_type: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en identification de types/catégories de produits.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}

TÂCHE: Identifie le type/catégorie exact

OÙ CHERCHER:
1. Nom du produit (souvent contient le type)
2. Photos du produit
3. Description commerciale
4. Catégorie sur sites e-commerce

TYPES AUTORISÉS (choisis UN SEUL):
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Analyse le NOM en priorité
- Vérifie les PHOTOS si disponibles
- Choisis le type le PLUS SPÉCIFIQUE
- Si plusieurs possibles, prends celui mentionné dans le nom

Réponds UNIQUEMENT avec: "N. [type]"
`,

  visual_color: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en identification de couleurs/finitions.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}

TÂCHE: Identifie la couleur/finition principale

OÙ CHERCHER:
1. Nom du produit (ex: "iPhone 14 Pro Noir Sidéral")
2. Photos produit (couleur dominante)
3. Variantes disponibles

COULEURS/FINITIONS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Cherche dans le NOM en priorité
- Vérifie la PHOTO principale
- Choisis la couleur/finition DOMINANTE
- Variantes: Noir, Blanc, Argent, Or, Bleu, etc.

Réponds UNIQUEMENT avec: "N. [couleur]"
`,

  functionality: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en fonctionnalités produit.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve "${attrName}"

OÙ CHERCHER:
1. Liste des fonctionnalités
2. Caractéristiques techniques
3. Description produit

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Cherche les fonctionnalités disponibles
- Vérifie les modes/options
- Note les caractéristiques spéciales

Réponds UNIQUEMENT avec: "N. [fonctionnalité]"
`,

  components: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en composants et accessoires.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve le type de "${attrName}"

OÙ CHERCHER:
1. Composants inclus
2. Accessoires fournis
3. Caractéristiques techniques

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Identifie les composants/accessoires
- Vérifie ce qui est inclus vs optionnel
- Note les matériaux utilisés

Réponds UNIQUEMENT avec: "N. [composant]"
`,

  boolean: (attrName, productName, brand, allowedValues) => `
Tu es un expert en vérification de fonctionnalités.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}

TÂCHE: Vérifie la présence de "${attrName}"

OÙ CHERCHER:
1. Liste des fonctionnalités
2. Caractéristiques techniques
3. Description produit

RÉPONSES AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- "Oui" si la fonctionnalité est présente/disponible
- "Non" si absente ou non mentionnée

Réponds UNIQUEMENT avec: "1. Oui" ou "2. Non"
`,

  label: (attrName, productName, brand, allowedValues) => `
Tu es un expert en labels et certifications officiels.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}

TÂCHE: Trouve le label "${attrName}"

OÙ CHERCHER:
1. Étiquette officielle (image)
2. Labels/certifications
3. Caractéristiques réglementaires

VALEURS AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Cherche le label OFFICIEL
- Vérifie la réglementation en vigueur
- Si plusieurs classes, prends la MEILLEURE

Réponds UNIQUEMENT avec: "N. [classe/label]"
`,

  brand: (attrName, productName, brand, allowedValues) => `
Tu es un expert en identification de marques.

PRODUIT:
- Nom: ${productName}
- Marque détectée: ${brand}

TÂCHE: Confirme la marque exacte

MARQUES AUTORISÉES:
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Utilise la marque DÉJÀ DÉTECTÉE si dans la liste
- Sinon, extrait du nom du produit
- Vérifie sur le site officiel

Réponds UNIQUEMENT avec: "N. [marque]"
`,

  generic: (attrName, productName, brand, allowedValues, productType = 'produit') => `
Tu es un expert en analyse de produits.

PRODUIT:
- Nom: ${productName}
- Marque: ${brand}
- Type: ${productType}

TÂCHE: Trouve la valeur de "${attrName}"

OÙ CHERCHER:
1. Fiche technique produit
2. Spécifications officielles
3. Sites e-commerce fiables

VALEURS AUTORISÉES (choisis UNIQUEMENT parmi):
${allowedValues.map((v, i) => `${i + 1}. ${v}`).join('\n')}

INSTRUCTIONS:
- Cherche l'information exacte sur le web
- Choisis la valeur la plus proche parmi les autorisées
- Si vraiment impossible, réponds "Non déterminé"

Réponds UNIQUEMENT avec: "N. [valeur]"
`
};

/**
 * Génère un prompt optimisé pour un attribut donné
 */
export function getPromptForAttribute(
  attributeName: string,
  productName: string,
  productBrand: string,
  allowedValues: string[],
  productType?: string
): string {
  const category = detectAttributeCategory(attributeName);
  const template = PROMPT_TEMPLATES[category];
  
  return template(attributeName, productName, productBrand, allowedValues, productType);
}

/**
 * Parse la réponse de l'IA pour extraire la valeur
 */
export function parseAttributeResponse(aiResponse: string, allowedValues: string[]): string {
  // Format attendu: "N. valeur"
  const match = aiResponse.match(/^\s*(\d+)\.\s*(.+)$/m);
  
  if (match) {
    const index = parseInt(match[1]) - 1;
    const extractedValue = match[2].trim();
    
    // Vérifier que l'index est valide
    if (allowedValues[index]) {
      return allowedValues[index];
    }
    
    // Fallback: chercher par similarité
    const found = allowedValues.find(v => 
      v.toLowerCase() === extractedValue.toLowerCase() ||
      v.toLowerCase().includes(extractedValue.toLowerCase()) ||
      extractedValue.toLowerCase().includes(v.toLowerCase())
    );
    
    if (found) return found;
  }
  
  // Fallback 2: chercher directement la valeur dans allowedValues
  const directMatch = allowedValues.find(v => 
    aiResponse.toLowerCase().includes(v.toLowerCase())
  );
  
  return directMatch || "Non déterminé";
}
