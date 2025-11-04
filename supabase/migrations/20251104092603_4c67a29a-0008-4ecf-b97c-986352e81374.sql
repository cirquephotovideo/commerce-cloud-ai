-- 1. Ajouter la catégorie "Générique" pour les produits non catégorisés
INSERT INTO product_categories (name, display_name, attribute_category, detection_keywords)
SELECT 'generic', 'Produits Génériques', 'generic', ARRAY['produit', 'article', 'item']
WHERE NOT EXISTS (SELECT 1 FROM product_categories WHERE attribute_category = 'generic');

-- 2. Ajouter des attributs de base universels
INSERT INTO product_attribute_definitions (category, attribute_name, attribute_value)
SELECT * FROM (VALUES
  -- Marque (valeurs communes)
  ('generic', 'Marque', 'Apple'),
  ('generic', 'Marque', 'Samsung'),
  ('generic', 'Marque', 'Sony'),
  ('generic', 'Marque', 'LG'),
  ('generic', 'Marque', 'Bosch'),
  ('generic', 'Marque', 'Siemens'),
  ('generic', 'Marque', 'Whirlpool'),
  ('generic', 'Marque', 'Philips'),
  ('generic', 'Marque', 'Microsoft'),
  ('generic', 'Marque', 'Google'),
  ('generic', 'Marque', 'Autre'),
  ('generic', 'Marque', 'Non déterminé'),
  
  -- Couleur
  ('generic', 'Couleur principale', 'Noir'),
  ('generic', 'Couleur principale', 'Blanc'),
  ('generic', 'Couleur principale', 'Gris'),
  ('generic', 'Couleur principale', 'Argent'),
  ('generic', 'Couleur principale', 'Bleu'),
  ('generic', 'Couleur principale', 'Rouge'),
  ('generic', 'Couleur principale', 'Vert'),
  ('generic', 'Couleur principale', 'Multicolore'),
  ('generic', 'Couleur principale', 'Non déterminé'),
  
  -- État
  ('generic', 'État', 'Neuf'),
  ('generic', 'État', 'Reconditionné'),
  ('generic', 'État', 'Occasion'),
  ('generic', 'État', 'Non déterminé'),
  
  -- Garantie
  ('generic', 'Garantie', '1 an'),
  ('generic', 'Garantie', '2 ans'),
  ('generic', 'Garantie', '3 ans'),
  ('generic', 'Garantie', '5 ans'),
  ('generic', 'Garantie', 'Non déterminé'),
  
  -- Origine
  ('generic', 'Pays d''origine', 'France'),
  ('generic', 'Pays d''origine', 'Allemagne'),
  ('generic', 'Pays d''origine', 'Chine'),
  ('generic', 'Pays d''origine', 'États-Unis'),
  ('generic', 'Pays d''origine', 'Japon'),
  ('generic', 'Pays d''origine', 'Corée du Sud'),
  ('generic', 'Pays d''origine', 'Non déterminé')
) AS v(category, attribute_name, attribute_value)
WHERE NOT EXISTS (
  SELECT 1 FROM product_attribute_definitions pad
  WHERE pad.category = v.category 
    AND pad.attribute_name = v.attribute_name 
    AND pad.attribute_value = v.attribute_value
);

-- 3. Créer le prompt initial pour enrich-odoo-attributes
INSERT INTO ai_prompts (
  function_name,
  prompt_key,
  prompt_type,
  prompt_content,
  model,
  temperature,
  is_active,
  version
)
SELECT 
  'enrich-odoo-attributes',
  'odoo_attribute_extraction',
  'system',
  'Tu es un expert en classification de produits pour Odoo.

Voici les définitions d''attributs Odoo pour la catégorie {CATEGORY} :

{ATTRIBUTE_SCHEMA}

PRODUIT À ANALYSER :

{PRODUCT_CONTEXT}

RÈGLES STRICTES - AUCUNE HALLUCINATION TOLÉRÉE :
1. Tu DOIS choisir UNIQUEMENT des valeurs présentes dans le référentiel fourni
2. Si une valeur n''existe pas exactement, choisis la plus proche sémantiquement
3. Si impossible de déterminer, mets "Non déterminé"
4. NE GÉNÈRE AUCUN ATTRIBUT qui n''est pas dans le référentiel
5. Traite TOUS les attributs du référentiel
6. Sois cohérent avec les dimensions et spécifications
7. INTERDIT d''inventer des valeurs non listées

Réponds UNIQUEMENT avec un JSON valide contenant TOUS les attributs.',
  'google/gemini-2.5-flash',
  0.3,
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM ai_prompts 
  WHERE function_name = 'enrich-odoo-attributes' 
    AND prompt_key = 'odoo_attribute_extraction'
);