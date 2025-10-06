-- Ajouter tous les champs Amazon demandés à la table amazon_product_data
ALTER TABLE amazon_product_data 
ADD COLUMN IF NOT EXISTS browse_nodes jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS buy_box_seller_id text,
ADD COLUMN IF NOT EXISTS buy_box_seller_name text,
ADD COLUMN IF NOT EXISTS is_buy_box_amazon_fulfilled boolean,
ADD COLUMN IF NOT EXISTS is_buy_box_amazon_seller boolean,
ADD COLUMN IF NOT EXISTS is_buy_box_preorder boolean,
ADD COLUMN IF NOT EXISTS is_buy_box_out_of_stock boolean,
ADD COLUMN IF NOT EXISTS buy_box_ship_country text,
ADD COLUMN IF NOT EXISTS amazon_price numeric,
ADD COLUMN IF NOT EXISTS fba_new_price numeric,
ADD COLUMN IF NOT EXISTS lowest_collectible_price numeric,
ADD COLUMN IF NOT EXISTS lowest_refurbished_price numeric,
ADD COLUMN IF NOT EXISTS variation_count integer,
ADD COLUMN IF NOT EXISTS import_code text,
ADD COLUMN IF NOT EXISTS upc text,
ADD COLUMN IF NOT EXISTS part_number text,
ADD COLUMN IF NOT EXISTS offer_count_collectible integer,
ADD COLUMN IF NOT EXISTS offer_count_refurbished integer,
ADD COLUMN IF NOT EXISTS referral_fee_percentage numeric,
ADD COLUMN IF NOT EXISTS prep_pack_fees numeric,
ADD COLUMN IF NOT EXISTS package_quantity integer,
ADD COLUMN IF NOT EXISTS contributors jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS publication_date text,
ADD COLUMN IF NOT EXISTS release_date text,
ADD COLUMN IF NOT EXISTS item_count integer,
ADD COLUMN IF NOT EXISTS page_count integer,
ADD COLUMN IF NOT EXISTS is_trade_in_eligible boolean,
ADD COLUMN IF NOT EXISTS marketplace text;

-- Ajouter des commentaires pour la documentation
COMMENT ON COLUMN amazon_product_data.browse_nodes IS 'Nœuds de navigation Amazon (catégories)';
COMMENT ON COLUMN amazon_product_data.buy_box_seller_id IS 'ID du vendeur de la Buy Box';
COMMENT ON COLUMN amazon_product_data.buy_box_seller_name IS 'Nom du vendeur dans la Buy Box';
COMMENT ON COLUMN amazon_product_data.is_buy_box_amazon_fulfilled IS 'Buy Box gérée par Amazon (FBA)';
COMMENT ON COLUMN amazon_product_data.is_buy_box_amazon_seller IS 'Buy Box vendue par Amazon';
COMMENT ON COLUMN amazon_product_data.is_buy_box_preorder IS 'Buy Box en précommande';
COMMENT ON COLUMN amazon_product_data.is_buy_box_out_of_stock IS 'Buy Box en rupture de stock';
COMMENT ON COLUMN amazon_product_data.buy_box_ship_country IS 'Pays d''expédition de la Buy Box';
COMMENT ON COLUMN amazon_product_data.amazon_price IS 'Prix Amazon';
COMMENT ON COLUMN amazon_product_data.fba_new_price IS 'Prix le plus bas FBA en neuf';
COMMENT ON COLUMN amazon_product_data.lowest_collectible_price IS 'Prix le plus bas en collection';
COMMENT ON COLUMN amazon_product_data.lowest_refurbished_price IS 'Prix le plus bas en remis à neuf';
COMMENT ON COLUMN amazon_product_data.variation_count IS 'Nombre de variations du produit';
COMMENT ON COLUMN amazon_product_data.import_code IS 'Code d''importation';
COMMENT ON COLUMN amazon_product_data.upc IS 'Universal Product Code';
COMMENT ON COLUMN amazon_product_data.part_number IS 'Numéro de pièce';
COMMENT ON COLUMN amazon_product_data.offer_count_collectible IS 'Nombre d''offres en collection';
COMMENT ON COLUMN amazon_product_data.offer_count_refurbished IS 'Nombre d''offres en remis à neuf';
COMMENT ON COLUMN amazon_product_data.referral_fee_percentage IS 'Pourcentage de commission de référence';
COMMENT ON COLUMN amazon_product_data.prep_pack_fees IS 'Frais de préparation et d''emballage';
COMMENT ON COLUMN amazon_product_data.package_quantity IS 'Quantité par paquet';
COMMENT ON COLUMN amazon_product_data.contributors IS 'Les contributeurs (auteurs, éditeurs, etc.)';
COMMENT ON COLUMN amazon_product_data.publication_date IS 'Date de publication';
COMMENT ON COLUMN amazon_product_data.release_date IS 'Date de sortie';
COMMENT ON COLUMN amazon_product_data.item_count IS 'Nombre d''articles';
COMMENT ON COLUMN amazon_product_data.page_count IS 'Nombre de pages';
COMMENT ON COLUMN amazon_product_data.is_trade_in_eligible IS 'Éligible à l''échange';
COMMENT ON COLUMN amazon_product_data.marketplace IS 'Marketplace Amazon';