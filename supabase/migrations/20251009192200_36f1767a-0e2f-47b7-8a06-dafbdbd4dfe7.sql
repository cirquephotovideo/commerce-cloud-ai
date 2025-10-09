-- Créer la table pour l'historique des exports (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS public.export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES public.product_analyses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_type TEXT NOT NULL,
  exported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT CHECK (status IN ('success', 'failed', 'partial')) NOT NULL DEFAULT 'success',
  error_message TEXT,
  exported_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Activer RLS si pas déjà activé
DO $$ 
BEGIN
  ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Créer les politiques si elles n'existent pas
DO $$ 
BEGIN
  CREATE POLICY "Users can view their own export history"
    ON public.export_history
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE POLICY "Users can create their own export history"
    ON public.export_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_export_history_user_id ON public.export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_platform ON public.export_history(platform_type);
CREATE INDEX IF NOT EXISTS idx_export_history_status ON public.export_history(status);

-- Ajouter une colonne pour tracker les plateformes où un produit a été exporté
ALTER TABLE public.product_analyses 
ADD COLUMN IF NOT EXISTS exported_to_platforms TEXT[] DEFAULT '{}';