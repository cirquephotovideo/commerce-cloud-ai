-- Add default_model and web_search_enabled to ollama_configurations
ALTER TABLE public.ollama_configurations 
ADD COLUMN IF NOT EXISTS default_model TEXT DEFAULT 'gpt-oss:120b-cloud',
ADD COLUMN IF NOT EXISTS web_search_enabled BOOLEAN DEFAULT false;