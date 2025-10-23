-- Create test_execution_history table
CREATE TABLE IF NOT EXISTS public.test_execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL,
  test_suite TEXT NOT NULL CHECK (test_suite IN ('edge_functions', 'business_logic', 'user_flows', 'security', 'performance')),
  test_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'fail', 'skip')),
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  executed_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_test_execution_history_execution_id ON public.test_execution_history(execution_id);
CREATE INDEX idx_test_execution_history_status ON public.test_execution_history(status);
CREATE INDEX idx_test_execution_history_created_at ON public.test_execution_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.test_execution_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can view test history"
ON public.test_execution_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can insert test history"
ON public.test_execution_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Create test_suites_config table for test configuration
CREATE TABLE IF NOT EXISTS public.test_suites_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  test_cases JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.test_suites_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage test config"
ON public.test_suites_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));