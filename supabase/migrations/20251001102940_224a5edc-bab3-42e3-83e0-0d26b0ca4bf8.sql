-- Create table for custom field mappings
CREATE TABLE public.odoo_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_field TEXT NOT NULL,
  source_path TEXT NOT NULL,
  odoo_field TEXT NOT NULL,
  odoo_field_label TEXT NOT NULL,
  transformation TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.odoo_field_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own mappings"
ON public.odoo_field_mappings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mappings"
ON public.odoo_field_mappings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mappings"
ON public.odoo_field_mappings
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mappings"
ON public.odoo_field_mappings
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_odoo_field_mappings_updated_at
BEFORE UPDATE ON public.odoo_field_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();