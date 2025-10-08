-- Create enum for health check status
CREATE TYPE public.health_status AS ENUM ('operational', 'failing', 'untested', 'warning');

-- Create enum for issue severity
CREATE TYPE public.issue_severity AS ENUM ('critical', 'high', 'medium', 'low');

-- Create enum for feature category
CREATE TYPE public.feature_category AS ENUM ('optimization', 'missing_feature', 'ux_improvement', 'security', 'integration');

-- Table for system health logs
CREATE TABLE public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type TEXT NOT NULL,
  component_name TEXT NOT NULL,
  status public.health_status NOT NULL,
  test_result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  latency_ms INTEGER,
  tested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for feature suggestions
CREATE TABLE public.feature_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.feature_category NOT NULL,
  priority public.issue_severity NOT NULL,
  effort TEXT NOT NULL,
  impact TEXT NOT NULL,
  lovable_prompt TEXT NOT NULL,
  status TEXT DEFAULT 'suggested',
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for fix tracking
CREATE TABLE public.fix_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  component_name TEXT NOT NULL,
  severity public.issue_severity NOT NULL,
  description TEXT NOT NULL,
  lovable_prompt TEXT NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  fix_applied_at TIMESTAMP WITH TIME ZONE,
  retest_result TEXT,
  status TEXT DEFAULT 'open',
  fix_duration_minutes INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fix_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_health_logs
CREATE POLICY "Super admins can manage health logs"
ON public.system_health_logs
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view health logs"
ON public.system_health_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for feature_suggestions
CREATE POLICY "Super admins can manage suggestions"
ON public.feature_suggestions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view suggestions"
ON public.feature_suggestions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can vote on suggestions"
ON public.feature_suggestions
FOR UPDATE
USING (true)
WITH CHECK (true);

-- RLS Policies for fix_tracking
CREATE POLICY "Super admins can manage fix tracking"
ON public.fix_tracking
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can view fix tracking"
ON public.fix_tracking
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_health_logs_component ON public.system_health_logs(component_name);
CREATE INDEX idx_health_logs_status ON public.system_health_logs(status);
CREATE INDEX idx_health_logs_tested_at ON public.system_health_logs(tested_at DESC);
CREATE INDEX idx_suggestions_category ON public.feature_suggestions(category);
CREATE INDEX idx_suggestions_priority ON public.feature_suggestions(priority);
CREATE INDEX idx_fix_tracking_status ON public.fix_tracking(status);
CREATE INDEX idx_fix_tracking_severity ON public.fix_tracking(severity);

-- Create trigger for updated_at on feature_suggestions
CREATE TRIGGER update_feature_suggestions_updated_at
BEFORE UPDATE ON public.feature_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();