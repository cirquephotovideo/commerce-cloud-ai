-- Policy pour permettre l'upload des CSV Code2ASIN
CREATE POLICY "upload_code2asin_csvs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-imports'
  AND name LIKE 'code2asin-imports/' || auth.uid()::text || '/%'
);

-- Policy pour permettre la lecture des propres CSV
CREATE POLICY "read_own_code2asin_csvs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'supplier-imports'
  AND name LIKE 'code2asin-imports/' || auth.uid()::text || '/%'
);