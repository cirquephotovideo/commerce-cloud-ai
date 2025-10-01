-- Create Super Admin plan with unlimited access
INSERT INTO subscription_plans (
  name,
  description,
  price_monthly,
  price_yearly,
  currency,
  features,
  limits,
  is_active,
  display_order,
  stripe_product_id,
  stripe_price_id_monthly,
  stripe_price_id_yearly
) VALUES (
  'Super Admin',
  'Accès administrateur avec fonctionnalités illimitées',
  0,
  0,
  'EUR',
  '["Analyses illimitées", "Exports illimités", "Alertes illimitées", "Support prioritaire", "Accès à toutes les plateformes", "Gestion des utilisateurs"]'::jsonb,
  '{"product_analyses": -1, "google_shopping_searches": -1, "price_alerts": -1, "image_optimizations": -1}'::jsonb,
  true,
  0,
  'admin_access',
  NULL,
  NULL
)
ON CONFLICT DO NOTHING;