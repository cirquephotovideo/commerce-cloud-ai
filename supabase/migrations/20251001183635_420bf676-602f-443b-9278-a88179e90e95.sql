-- Create generic platform configurations table
CREATE TABLE IF NOT EXISTS public.platform_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('shopify', 'woocommerce', 'prestashop', 'magento', 'salesforce', 'sap', 'uber_eats', 'deliveroo', 'just_eat', 'windev')),
  platform_url TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  access_token_encrypted TEXT,
  additional_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, platform_type)
);

-- Create generic platform field mappings table
CREATE TABLE IF NOT EXISTS public.platform_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('shopify', 'woocommerce', 'prestashop', 'magento', 'salesforce', 'sap', 'uber_eats', 'deliveroo', 'just_eat', 'windev')),
  source_field TEXT NOT NULL,
  source_path TEXT NOT NULL,
  platform_field TEXT NOT NULL,
  platform_field_label TEXT NOT NULL,
  transformation TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create generic platform categories table
CREATE TABLE IF NOT EXISTS public.platform_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('shopify', 'woocommerce', 'prestashop', 'magento', 'salesforce', 'sap', 'uber_eats', 'deliveroo', 'just_eat', 'windev')),
  platform_category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  parent_id TEXT,
  parent_name TEXT,
  full_path TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create generic platform export logs table
CREATE TABLE IF NOT EXISTS public.platform_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('shopify', 'woocommerce', 'prestashop', 'magento', 'salesforce', 'sap', 'uber_eats', 'deliveroo', 'just_eat', 'windev')),
  products_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  export_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.platform_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_export_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_configurations
CREATE POLICY "Users can view their own platform configurations"
  ON public.platform_configurations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own platform configurations"
  ON public.platform_configurations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own platform configurations"
  ON public.platform_configurations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own platform configurations"
  ON public.platform_configurations FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for platform_field_mappings
CREATE POLICY "Users can view their own platform field mappings"
  ON public.platform_field_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own platform field mappings"
  ON public.platform_field_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own platform field mappings"
  ON public.platform_field_mappings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own platform field mappings"
  ON public.platform_field_mappings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for platform_categories
CREATE POLICY "Users can view their own platform categories"
  ON public.platform_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own platform categories"
  ON public.platform_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own platform categories"
  ON public.platform_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own platform categories"
  ON public.platform_categories FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for platform_export_logs
CREATE POLICY "Users can view their own platform export logs"
  ON public.platform_export_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own platform export logs"
  ON public.platform_export_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_platform_configurations_user_platform 
  ON public.platform_configurations(user_id, platform_type);

CREATE INDEX IF NOT EXISTS idx_platform_field_mappings_user_platform 
  ON public.platform_field_mappings(user_id, platform_type);

CREATE INDEX IF NOT EXISTS idx_platform_categories_user_platform 
  ON public.platform_categories(user_id, platform_type);

CREATE INDEX IF NOT EXISTS idx_platform_export_logs_user_platform 
  ON public.platform_export_logs(user_id, platform_type, created_at DESC);

-- Add triggers for updated_at
CREATE TRIGGER update_platform_configurations_updated_at
  BEFORE UPDATE ON public.platform_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_field_mappings_updated_at
  BEFORE UPDATE ON public.platform_field_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();