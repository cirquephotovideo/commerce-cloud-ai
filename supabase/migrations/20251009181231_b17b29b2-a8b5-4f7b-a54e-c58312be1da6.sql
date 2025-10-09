-- Create enum for supplier types
CREATE TYPE supplier_type AS ENUM (
  'email',
  'ftp',
  'sftp',
  'api',
  'prestashop',
  'odoo',
  'sap',
  'file'
);

CREATE TYPE import_status AS ENUM (
  'success',
  'partial',
  'failed'
);

-- Table: supplier_configurations
CREATE TABLE public.supplier_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  supplier_type supplier_type NOT NULL,
  is_active BOOLEAN DEFAULT true,
  connection_config JSONB DEFAULT '{}'::jsonb,
  mapping_config JSONB DEFAULT '{}'::jsonb,
  sync_frequency TEXT DEFAULT 'manual',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: supplier_products
CREATE TABLE public.supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  supplier_reference TEXT,
  ean TEXT,
  product_name TEXT NOT NULL,
  purchase_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'EUR',
  stock_quantity INTEGER,
  minimum_order_quantity INTEGER,
  delivery_time_days INTEGER,
  supplier_url TEXT,
  additional_data JSONB DEFAULT '{}'::jsonb,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: supplier_import_logs
CREATE TABLE public.supplier_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL,
  source_file TEXT,
  products_found INTEGER DEFAULT 0,
  products_matched INTEGER DEFAULT 0,
  products_new INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_failed INTEGER DEFAULT 0,
  import_status import_status NOT NULL,
  error_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: supplier_price_history
CREATE TABLE public.supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_product_id UUID NOT NULL REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  purchase_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'EUR',
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add columns to product_analyses
ALTER TABLE public.product_analyses
ADD COLUMN IF NOT EXISTS supplier_product_id UUID REFERENCES public.supplier_products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS purchase_price NUMERIC,
ADD COLUMN IF NOT EXISTS purchase_currency TEXT DEFAULT 'EUR',
ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.supplier_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_price_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_configurations
CREATE POLICY "Users can manage their own supplier configurations"
ON public.supplier_configurations
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for supplier_products
CREATE POLICY "Users can manage their own supplier products"
ON public.supplier_products
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for supplier_import_logs
CREATE POLICY "Users can view their own import logs"
ON public.supplier_import_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can insert import logs"
ON public.supplier_import_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for supplier_price_history
CREATE POLICY "Users can view their own price history"
ON public.supplier_price_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_products
    WHERE supplier_products.id = supplier_price_history.supplier_product_id
    AND supplier_products.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert price history"
ON public.supplier_price_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.supplier_products
    WHERE supplier_products.id = supplier_price_history.supplier_product_id
    AND supplier_products.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_supplier_products_ean ON public.supplier_products(ean);
CREATE INDEX idx_supplier_products_supplier_id ON public.supplier_products(supplier_id);
CREATE INDEX idx_supplier_products_user_id ON public.supplier_products(user_id);
CREATE INDEX idx_product_analyses_supplier_product_id ON public.product_analyses(supplier_product_id);

-- Trigger to update updated_at
CREATE TRIGGER update_supplier_configurations_updated_at
BEFORE UPDATE ON public.supplier_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to track price changes
CREATE OR REPLACE FUNCTION track_supplier_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.purchase_price IS DISTINCT FROM OLD.purchase_price THEN
    INSERT INTO supplier_price_history (supplier_product_id, purchase_price, currency)
    VALUES (NEW.id, NEW.purchase_price, NEW.currency);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER track_supplier_price_changes
AFTER UPDATE ON public.supplier_products
FOR EACH ROW
EXECUTE FUNCTION track_supplier_price_change();