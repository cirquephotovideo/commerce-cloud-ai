
-- Update Starter plan with Stripe IDs
UPDATE subscription_plans SET 
  stripe_product_id = 'prod_T9oHbOH6GRz5IS',
  stripe_price_id_monthly = 'price_1SDUekIhbQ0wttwsmWzWVbMa',
  stripe_price_id_yearly = 'price_1SDUfZIhbQ0wttwsBjXDQYsU'
WHERE name = 'Starter';

-- Update Pro plan with Stripe IDs
UPDATE subscription_plans SET
  stripe_product_id = 'prod_T9oIi4tlxUhAdT',
  stripe_price_id_monthly = 'price_1SDUfzIhbQ0wttws13RjTu6a',
  stripe_price_id_yearly = 'price_1SDUgLIhbQ0wttwsPxNLgCta'
WHERE name = 'Pro';

-- Update Business plan with Stripe IDs
UPDATE subscription_plans SET
  stripe_product_id = 'prod_T9oJFWq2TV56m1',
  stripe_price_id_monthly = 'price_1SDUh8IhbQ0wttwsuzacEVT3',
  stripe_price_id_yearly = 'price_1SDUhdIhbQ0wttwsfGGChZtV'
WHERE name = 'Business';
