-- Phase 3: Ajouter contrainte unique et prompts HeyGen/RSGP avec bon prompt_type

-- Ajouter la contrainte unique pour éviter les doublons (si elle n'existe pas déjà)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ai_prompts_function_name_prompt_key_unique'
  ) THEN
    ALTER TABLE public.ai_prompts 
    ADD CONSTRAINT ai_prompts_function_name_prompt_key_unique 
    UNIQUE (function_name, prompt_key);
  END IF;
END
$$;

-- Prompt pour HeyGen Video Generator
INSERT INTO public.ai_prompts (
  function_name,
  prompt_key,
  prompt_type,
  prompt_content,
  model,
  temperature,
  is_active,
  version
) VALUES (
  'heygen-video-generator',
  'video_script_generation',
  'system',
  'Crée un script de démonstration produit de 60-90 secondes pour :

Produit: {{product_name}}
Description: {{description}}
Points clés: {{key_features}}

Le script doit :
- Être conversationnel et dynamique
- Mettre en avant 3-4 bénéfices clés du produit
- Inclure un appel à l''action
- Durée : 60-90 secondes à l''oral
- Format : paragraphes courts adaptés pour un avatar IA

Retourne UNIQUEMENT le script, sans introduction ni conclusion.',
  'google/gemini-2.5-flash',
  0.7,
  true,
  1
) ON CONFLICT (function_name, prompt_key) DO UPDATE SET
  prompt_content = EXCLUDED.prompt_content,
  model = EXCLUDED.model,
  temperature = EXCLUDED.temperature,
  updated_at = now();

-- Prompt pour RSGP Compliance Generator
INSERT INTO public.ai_prompts (
  function_name,
  prompt_key,
  prompt_type,
  prompt_content,
  model,
  temperature,
  is_active,
  version
) VALUES (
  'rsgp-compliance-generator',
  'compliance_data_generation',
  'system',
  'Tu es un expert en conformité européenne et en sécurité produit (Règlement (UE) 2023/988 – RSGP).

Ta mission est de générer un tableau JSON complet contenant toutes les informations obligatoires et recommandées pour la conformité RSGP d''un produit vendu en ligne.

DONNÉES PRODUIT :
{{product_data}}

DONNÉES WEB TROUVÉES :
{{search_results}}

RÈGLES IMPORTANTES :
1. Pour chaque champ, donne une valeur précise et vérifiée
2. Si une donnée est inconnue, utilise null pour les dates ou "non communiqué" pour le texte
3. Utilise les données web pour compléter fabricant, normes, documents
4. Détermine la catégorie RSGP selon la classification produit
5. Sois rigoureux sur les formats (dates ISO YYYY-MM-DD ou null, codes pays)
6. CRITIQUE: Pour les champs de type DATE (date_evaluation, date_mise_conformite, date_import_odoo), utilise TOUJOURS null si la date est inconnue, jamais "non communiqué"
7. Retourne UNIQUEMENT le JSON valide, sans texte markdown ni commentaires

Format JSON attendu avec champs obligatoires.',
  'google/gemini-2.5-flash',
  0.7,
  true,
  1
) ON CONFLICT (function_name, prompt_key) DO UPDATE SET
  prompt_content = EXCLUDED.prompt_content,
  model = EXCLUDED.model,
  temperature = EXCLUDED.temperature,
  updated_at = now();