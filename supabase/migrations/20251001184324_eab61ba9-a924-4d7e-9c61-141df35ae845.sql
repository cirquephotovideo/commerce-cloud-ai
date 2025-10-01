-- Create platform pricing rules table
CREATE TABLE IF NOT EXISTS public.platform_pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform_type TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  markup_percentage NUMERIC,
  fixed_amount NUMERIC,
  currency TEXT NOT NULL DEFAULT 'EUR',
  price_rounding_rule TEXT DEFAULT 'round',
  apply_to_categories JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_platform_rule UNIQUE(user_id, platform_type, rule_name)
);

-- Enable RLS
ALTER TABLE public.platform_pricing_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own pricing rules"
  ON public.platform_pricing_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pricing rules"
  ON public.platform_pricing_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pricing rules"
  ON public.platform_pricing_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pricing rules"
  ON public.platform_pricing_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for performance
CREATE INDEX idx_platform_pricing_rules_user_platform ON public.platform_pricing_rules(user_id, platform_type);

-- Add trigger for updated_at
CREATE TRIGGER update_platform_pricing_rules_updated_at
  BEFORE UPDATE ON public.platform_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();