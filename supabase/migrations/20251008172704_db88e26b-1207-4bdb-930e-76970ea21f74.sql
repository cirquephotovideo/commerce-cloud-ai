-- Create enum for Google service types
CREATE TYPE public.google_service_type AS ENUM ('merchant_center', 'shopping_api', 'analytics', 'search_console');

-- Create google_services_config table
CREATE TABLE public.google_services_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_type google_service_type NOT NULL,
  merchant_id TEXT,
  api_key_encrypted TEXT,
  client_id_encrypted TEXT,
  client_secret_encrypted TEXT,
  measurement_id TEXT,
  site_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, service_type)
);

-- Enable RLS
ALTER TABLE public.google_services_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own Google configs"
  ON public.google_services_config
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Google configs"
  ON public.google_services_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Google configs"
  ON public.google_services_config
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Google configs"
  ON public.google_services_config
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all Google configs"
  ON public.google_services_config
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_google_services_config_updated_at
  BEFORE UPDATE ON public.google_services_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();