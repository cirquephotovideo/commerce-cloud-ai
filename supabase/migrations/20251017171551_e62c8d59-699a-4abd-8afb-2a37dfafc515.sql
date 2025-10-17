-- Créer un bucket dédié pour les imports fournisseurs
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-imports', 'supplier-imports', false)
ON CONFLICT (id) DO NOTHING;

-- RLS : Les utilisateurs peuvent uploader leurs propres imports
CREATE POLICY "Users can upload their own imports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'supplier-imports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS : Les utilisateurs peuvent lire leurs propres imports
CREATE POLICY "Users can read their own imports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'supplier-imports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS : Les utilisateurs peuvent supprimer leurs propres imports
CREATE POLICY "Users can delete their own imports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'supplier-imports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);