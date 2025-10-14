-- Add MCP chat integration columns to platform_configurations
ALTER TABLE public.platform_configurations 
ADD COLUMN IF NOT EXISTS mcp_chat_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS mcp_allowed_tools jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS mcp_version_client text,
ADD COLUMN IF NOT EXISTS mcp_version_server text;