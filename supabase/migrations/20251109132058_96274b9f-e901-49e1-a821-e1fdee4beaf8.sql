-- Activer le realtime pour les tables d'import/export
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_import_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.export_history;