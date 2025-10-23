-- Améliorer les mots-clés pour détecter les logiciels de sécurité (Sophos, XGS, etc.)
UPDATE product_categories
SET detection_keywords = ARRAY[
  'software', 'licence', 'subscription', 'saas', 'cloud',
  'detection', 'response', 'endpoint', 'firewall', 'antivirus',
  'protection', 'security', 'zero-day', 'mdr', 'xdr', 'edr',
  'sophos', 'central', 'intercept', 'managed', 'xgs'
]
WHERE attribute_category = 'logiciels';

-- Créer une catégorie pour les smartphones si elle n'existe pas
INSERT INTO product_categories (name, display_name, attribute_category, detection_keywords)
SELECT 'smartphones', 'Smartphones & Téléphones', 'smartphones', 
       ARRAY['iphone', 'smartphone', 'galaxy', 'pixel', 'téléphone', 'mobile', 'android', 'ios']
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories WHERE attribute_category = 'smartphones'
);

-- Ajouter des attributs Odoo pour smartphones (ignore les doublons existants)
INSERT INTO product_attribute_definitions (attribute_name, attribute_value, category)
SELECT * FROM (VALUES
  ('Marque', 'Apple', 'smartphones'),
  ('Marque', 'Samsung', 'smartphones'),
  ('Marque', 'Google', 'smartphones'),
  ('Marque', 'Xiaomi', 'smartphones'),
  ('Marque', 'Huawei', 'smartphones'),
  ('Capacité de stockage', '64 GB', 'smartphones'),
  ('Capacité de stockage', '128 GB', 'smartphones'),
  ('Capacité de stockage', '256 GB', 'smartphones'),
  ('Capacité de stockage', '512 GB', 'smartphones'),
  ('Capacité de stockage', '1 TB', 'smartphones'),
  ('Couleur', 'Noir', 'smartphones'),
  ('Couleur', 'Blanc', 'smartphones'),
  ('Couleur', 'Bleu', 'smartphones'),
  ('Couleur', 'Rose', 'smartphones'),
  ('Couleur', 'Vert', 'smartphones'),
  ('Couleur', 'Violet', 'smartphones'),
  ('Couleur', 'Gris', 'smartphones'),
  ('Taille d''écran', '5.8 pouces', 'smartphones'),
  ('Taille d''écran', '6.1 pouces', 'smartphones'),
  ('Taille d''écran', '6.7 pouces', 'smartphones'),
  ('Taille d''écran', '6.9 pouces', 'smartphones'),
  ('Réseau', '5G', 'smartphones'),
  ('Réseau', '4G', 'smartphones'),
  ('État', 'Neuf', 'smartphones'),
  ('État', 'Reconditionné', 'smartphones'),
  ('État', 'Occasion', 'smartphones'),
  ('Dual SIM', 'Oui', 'smartphones'),
  ('Dual SIM', 'Non', 'smartphones')
) AS v(attribute_name, attribute_value, category)
WHERE NOT EXISTS (
  SELECT 1 FROM product_attribute_definitions 
  WHERE product_attribute_definitions.attribute_name = v.attribute_name 
    AND product_attribute_definitions.attribute_value = v.attribute_value 
    AND product_attribute_definitions.category = v.category
);