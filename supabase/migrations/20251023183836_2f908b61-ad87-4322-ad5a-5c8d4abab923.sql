-- 1. Créer la table product_categories pour gérer les catégories de produits
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  attribute_category TEXT NOT NULL,
  detection_keywords TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ajouter la colonne category dans product_analyses
ALTER TABLE product_analyses
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'non_categorise';

-- 3. Créer un index pour optimiser les recherches par catégorie
CREATE INDEX IF NOT EXISTS idx_product_analyses_category ON product_analyses(category);

-- 4. Insérer les catégories initiales
INSERT INTO product_categories (name, display_name, attribute_category, detection_keywords) VALUES
  ('hottes', 'Hottes de cuisine', 'hottes', ARRAY['hotte', 'extraction', 'ventilation', 'aspiration', 'cuisinière']),
  ('logiciels', 'Logiciels & Licences', 'logiciels', ARRAY['software', 'licence', 'license', 'subscription', 'saas', 'cloud', 'antivirus', 'sophos', 'kaspersky', 'mcafee', 'norton', 'endpoint', 'firewall', 'detection', 'response', 'mdr', 'edr']),
  ('electromenager', 'Électroménager', 'electromenager', ARRAY['réfrigérateur', 'lave-linge', 'four', 'micro-ondes', 'lave-vaisselle', 'sèche-linge', 'congélateur']),
  ('informatique', 'Matériel Informatique', 'informatique', ARRAY['ordinateur', 'laptop', 'serveur', 'routeur', 'switch', 'pc', 'écran', 'clavier', 'souris', 'imprimante'])
ON CONFLICT (name) DO NOTHING;

-- 5. Créer des attributs Odoo pour la catégorie logiciels
INSERT INTO product_attribute_definitions (attribute_name, attribute_value, category) VALUES
  ('Type de licence', 'Perpétuelle', 'logiciels'),
  ('Type de licence', 'Abonnement annuel', 'logiciels'),
  ('Type de licence', 'Abonnement mensuel', 'logiciels'),
  ('Type de licence', 'Abonnement triennal', 'logiciels'),
  ('Déploiement', 'Cloud', 'logiciels'),
  ('Déploiement', 'On-premise', 'logiciels'),
  ('Déploiement', 'Hybride', 'logiciels'),
  ('Nombre d''utilisateurs', '1-10', 'logiciels'),
  ('Nombre d''utilisateurs', '11-50', 'logiciels'),
  ('Nombre d''utilisateurs', '51-100', 'logiciels'),
  ('Nombre d''utilisateurs', '101-500', 'logiciels'),
  ('Nombre d''utilisateurs', 'Illimité', 'logiciels'),
  ('Support inclus', 'Oui', 'logiciels'),
  ('Support inclus', 'Non', 'logiciels'),
  ('Type de support', '24/7', 'logiciels'),
  ('Type de support', 'Heures ouvrées', 'logiciels'),
  ('Type de support', 'Email uniquement', 'logiciels'),
  ('Conformité', 'RGPD', 'logiciels'),
  ('Conformité', 'ISO 27001', 'logiciels'),
  ('Conformité', 'SOC 2', 'logiciels'),
  ('Système d''exploitation', 'Windows', 'logiciels'),
  ('Système d''exploitation', 'MacOS', 'logiciels'),
  ('Système d''exploitation', 'Linux', 'logiciels'),
  ('Système d''exploitation', 'Multi-plateforme', 'logiciels'),
  ('Type de solution', 'Antivirus', 'logiciels'),
  ('Type de solution', 'EDR', 'logiciels'),
  ('Type de solution', 'MDR', 'logiciels'),
  ('Type de solution', 'XDR', 'logiciels'),
  ('Type de solution', 'Firewall', 'logiciels'),
  ('Type de solution', 'SIEM', 'logiciels'),
  ('Niveau de protection', 'Basic', 'logiciels'),
  ('Niveau de protection', 'Standard', 'logiciels'),
  ('Niveau de protection', 'Advanced', 'logiciels'),
  ('Niveau de protection', 'Complete', 'logiciels')
ON CONFLICT DO NOTHING;

-- 6. Activer RLS sur product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- 7. Politique RLS : tous les utilisateurs authentifiés peuvent lire les catégories
CREATE POLICY "Users can view product categories"
  ON product_categories FOR SELECT
  USING (true);

-- 8. Politique RLS : seuls les super admins peuvent modifier les catégories
CREATE POLICY "Super admins can manage product categories"
  ON product_categories FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));