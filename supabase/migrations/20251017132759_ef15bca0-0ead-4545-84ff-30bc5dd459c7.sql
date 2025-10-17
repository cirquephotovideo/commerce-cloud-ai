-- Vérifier et corriger la contrainte CHECK de import_jobs pour autoriser 'queued'

-- Supprimer l'ancienne contrainte si elle existe
ALTER TABLE import_jobs 
DROP CONSTRAINT IF EXISTS import_jobs_status_check;

-- Créer la nouvelle contrainte avec 'queued' autorisé
ALTER TABLE import_jobs
ADD CONSTRAINT import_jobs_status_check
CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed'));