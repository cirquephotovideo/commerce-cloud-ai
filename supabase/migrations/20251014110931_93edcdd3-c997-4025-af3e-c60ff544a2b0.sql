-- Create table for storing pre-computed chat contexts per product
CREATE TABLE IF NOT EXISTS public.product_chat_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL,
  context_text text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  last_built_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'building', 'error')),
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

-- Enable RLS
ALTER TABLE public.product_chat_contexts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own contexts
CREATE POLICY "Users can view their own chat contexts"
  ON public.product_chat_contexts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat contexts"
  ON public.product_chat_contexts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat contexts"
  ON public.product_chat_contexts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat contexts"
  ON public.product_chat_contexts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_chat_contexts_user_id ON public.product_chat_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_product_chat_contexts_product_id ON public.product_chat_contexts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_chat_contexts_status ON public.product_chat_contexts(status);

-- Trigger to update updated_at
CREATE OR REPLACE TRIGGER update_product_chat_contexts_updated_at
  BEFORE UPDATE ON public.product_chat_contexts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();