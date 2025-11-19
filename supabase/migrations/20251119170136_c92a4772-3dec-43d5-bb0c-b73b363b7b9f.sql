-- Add linking statistics columns to supplier_import_chunk_jobs
ALTER TABLE supplier_import_chunk_jobs
  ADD COLUMN IF NOT EXISTS links_created integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlinked_products integer DEFAULT 0;