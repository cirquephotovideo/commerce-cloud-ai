-- Optimisations pour éviter les timeouts SQL et améliorer les performances

-- 1. Augmenter le timeout de la fonction de fusion (de 30s à 120s)
ALTER FUNCTION bulk_create_product_links_cursor(uuid, integer, uuid)
SET statement_timeout = '120s';

-- 2. Ajouter des index composites pour accélérer les jointures EAN
CREATE INDEX IF NOT EXISTS idx_supplier_products_ean_user 
ON supplier_products(normalized_ean, user_id) 
WHERE normalized_ean IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_analyses_ean_user 
ON product_analyses(normalized_ean, user_id) 
WHERE normalized_ean IS NOT NULL;

-- 3. Améliorer les performances des recherches
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status_priority
ON enrichment_queue(status, priority DESC, created_at ASC)
WHERE status = 'pending';