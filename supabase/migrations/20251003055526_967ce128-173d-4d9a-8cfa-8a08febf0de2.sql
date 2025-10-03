-- Create aws_credentials table
CREATE TABLE IF NOT EXISTS public.aws_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  access_key_id_encrypted TEXT NOT NULL,
  secret_access_key_encrypted TEXT NOT NULL,
  role_arn TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'eu-west-1',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_aws_credentials_user ON public.aws_credentials(user_id);
CREATE INDEX idx_aws_credentials_active ON public.aws_credentials(is_active);

-- Enable RLS
ALTER TABLE public.aws_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies for admins
CREATE POLICY "Super admins can manage AWS credentials"
ON public.aws_credentials
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_aws_credentials_updated_at
BEFORE UPDATE ON public.aws_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();