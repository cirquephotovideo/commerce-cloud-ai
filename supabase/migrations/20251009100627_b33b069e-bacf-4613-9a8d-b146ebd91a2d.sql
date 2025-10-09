-- Étape 1: Supprimer les lignes avec des providers non supportés par la contrainte actuelle
DELETE FROM ai_provider_health
WHERE provider NOT IN ('claude', 'openai', 'openrouter');

-- Étape 2: Supprimer l'ancienne contrainte CHECK
ALTER TABLE ai_provider_health
  DROP CONSTRAINT IF EXISTS ai_provider_health_provider_check;

-- Étape 3: Ajouter la nouvelle contrainte CHECK incluant heygen et ollama
ALTER TABLE ai_provider_health
  ADD CONSTRAINT ai_provider_health_provider_check
  CHECK (provider IN ('claude', 'openai', 'openrouter', 'ollama', 'heygen'));