-- Create table for Odoo configurations
CREATE TABLE public.odoo_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  odoo_url TEXT NOT NULL,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.odoo_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for odoo_configurations
CREATE POLICY "Users can view their own configurations"
  ON public.odoo_configurations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own configurations"
  ON public.odoo_configurations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own configurations"
  ON public.odoo_configurations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own configurations"
  ON public.odoo_configurations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create table for export logs
CREATE TABLE public.export_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  products_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  export_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for export_logs
CREATE POLICY "Users can view their own export logs"
  ON public.export_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own export logs"
  ON public.export_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on odoo_configurations
CREATE TRIGGER update_odoo_configurations_updated_at
  BEFORE UPDATE ON public.odoo_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();