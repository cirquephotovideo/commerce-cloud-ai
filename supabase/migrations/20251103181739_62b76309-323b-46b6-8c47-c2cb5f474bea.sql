-- Create system settings table for global configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write system settings
CREATE POLICY "Super admins can manage system settings"
ON public.system_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default enrichment settings
INSERT INTO public.system_settings (key, value)
VALUES ('enrichment_paused', '{"paused": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;