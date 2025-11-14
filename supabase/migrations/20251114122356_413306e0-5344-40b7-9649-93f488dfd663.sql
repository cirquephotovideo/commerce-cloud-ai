-- Ajouter un index composite critique pour ProductLinksDashboard
-- Cet index permet de trier et filtrer rapidement sans scanner toutes les lignes
CREATE INDEX IF NOT EXISTS idx_product_links_user_created 
  ON product_links(user_id, created_at DESC);

-- Également utile pour les requêtes de statistiques
CREATE INDEX IF NOT EXISTS idx_product_links_user_type 
  ON product_links(user_id, link_type);