-- Corriger l'email IMAP de comeline (typo: comline -> comeline)
UPDATE public.supplier_configurations
SET connection_config = jsonb_set(
  connection_config,
  '{imap_email}',
  '"biz.comeline@planetetechnologie.biz"'
)
WHERE connection_config->>'imap_email' = 'biz.comline@planetetechnologie.biz';