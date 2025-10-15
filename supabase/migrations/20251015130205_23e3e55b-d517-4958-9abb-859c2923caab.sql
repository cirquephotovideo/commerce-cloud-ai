-- Create ecommerce_orders table
CREATE TABLE IF NOT EXISTS public.ecommerce_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Identification commande
  order_number TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_configuration_id UUID REFERENCES public.platform_configurations(id),
  
  -- Informations client
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  
  -- Détails commande
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  items_count INTEGER DEFAULT 0,
  
  -- Produits (JSON array)
  order_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Adresse livraison
  shipping_address JSONB,
  billing_address JSONB,
  
  -- Dates importantes
  order_date TIMESTAMPTZ NOT NULL,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Métadonnées
  raw_data JSONB,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, platform, external_order_id)
);

-- Index pour performance
CREATE INDEX idx_ecommerce_orders_user_id ON public.ecommerce_orders(user_id);
CREATE INDEX idx_ecommerce_orders_platform ON public.ecommerce_orders(platform);
CREATE INDEX idx_ecommerce_orders_status ON public.ecommerce_orders(status);
CREATE INDEX idx_ecommerce_orders_order_date ON public.ecommerce_orders(order_date DESC);
CREATE INDEX idx_ecommerce_orders_external_id ON public.ecommerce_orders(external_order_id);

-- Trigger updated_at
CREATE TRIGGER update_ecommerce_orders_updated_at
  BEFORE UPDATE ON public.ecommerce_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON public.ecommerce_orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON public.ecommerce_orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
  ON public.ecommerce_orders
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON public.ecommerce_orders
  FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can insert orders"
  ON public.ecommerce_orders
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update orders"
  ON public.ecommerce_orders
  FOR UPDATE
  USING (true);