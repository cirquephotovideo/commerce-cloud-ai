-- Create supplier_mapping_profiles table for unified mapping configuration
CREATE TABLE IF NOT EXISTS public.supplier_mapping_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.supplier_configurations(id) ON DELETE CASCADE,
  
  profile_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('email', 'ftp', 'file', 'api')),
  
  -- Skip configuration for rows
  skip_config JSONB DEFAULT '{
    "skip_rows_top": 0,
    "skip_rows_bottom": 0,
    "skip_patterns": []
  }'::jsonb,
  
  -- Excluded columns
  excluded_columns TEXT[] DEFAULT '{}',
  
  -- Unified mapping format
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.supplier_mapping_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mapping profiles"
ON public.supplier_mapping_profiles
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_supplier_mapping_profiles_supplier_id 
ON public.supplier_mapping_profiles(supplier_id);

CREATE INDEX idx_supplier_mapping_profiles_user_id 
ON public.supplier_mapping_profiles(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_supplier_mapping_profiles_updated_at
BEFORE UPDATE ON public.supplier_mapping_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();