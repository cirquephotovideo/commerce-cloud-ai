-- 1. Supprimer les lignes avec des providers non autorisés
DELETE FROM ai_provider_configs 
WHERE provider NOT IN ('claude', 'openai', 'openrouter');

-- 2. Supprimer l'ancienne contrainte CHECK
ALTER TABLE ai_provider_configs 
  DROP CONSTRAINT IF EXISTS ai_provider_configs_provider_check;

-- 3. Ajouter la colonne user_id (nullable)
ALTER TABLE ai_provider_configs 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Ajouter la nouvelle contrainte CHECK avec tous les providers
ALTER TABLE ai_provider_configs 
  ADD CONSTRAINT ai_provider_configs_provider_check 
  CHECK (provider IN ('claude', 'openai', 'openrouter', 'ollama', 'heygen'));

-- 5. Créer des index pour performance
CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_user_id 
  ON ai_provider_configs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_user_provider 
  ON ai_provider_configs(user_id, provider);

-- 6. Supprimer l'ancienne contrainte unique
ALTER TABLE ai_provider_configs 
  DROP CONSTRAINT IF EXISTS ai_provider_configs_provider_key;

-- 7. Ajouter la nouvelle contrainte unique (user_id, provider)
ALTER TABLE ai_provider_configs 
  ADD CONSTRAINT ai_provider_configs_user_provider_unique 
  UNIQUE (user_id, provider);

-- 8. Politiques RLS pour les utilisateurs (SELECT permet de voir ses configs + configs globales)
CREATE POLICY "Users can view their own AI provider configs"
  ON ai_provider_configs FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create their own AI provider configs"
  ON ai_provider_configs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI provider configs"
  ON ai_provider_configs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI provider configs"
  ON ai_provider_configs FOR DELETE
  USING (auth.uid() = user_id);