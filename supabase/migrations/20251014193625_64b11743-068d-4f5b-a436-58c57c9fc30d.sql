-- Créer la table pour les logs d'appels MCP
CREATE TABLE IF NOT EXISTS public.mcp_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_args JSONB DEFAULT '{}'::jsonb,
  response_data JSONB,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour améliorer les performances
CREATE INDEX idx_mcp_call_logs_user_id ON public.mcp_call_logs(user_id);
CREATE INDEX idx_mcp_call_logs_package_id ON public.mcp_call_logs(package_id);
CREATE INDEX idx_mcp_call_logs_created_at ON public.mcp_call_logs(created_at DESC);

-- RLS policies
ALTER TABLE public.mcp_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MCP logs"
  ON public.mcp_call_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert MCP logs"
  ON public.mcp_call_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Super admins can view all MCP logs"
  ON public.mcp_call_logs FOR SELECT
  USING (has_role(auth.uid(), 'super_admin'::app_role));

COMMENT ON TABLE public.mcp_call_logs IS 'Logs de tous les appels MCP pour audit et debugging';