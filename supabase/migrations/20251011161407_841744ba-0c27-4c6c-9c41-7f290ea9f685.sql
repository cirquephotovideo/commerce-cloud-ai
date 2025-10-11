-- Créer le bucket de stockage pour les pièces jointes d'emails
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-attachments',
  'email-attachments',
  false,
  10485760, -- 10 MB
  ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'application/pdf']
);

-- RLS policies pour le bucket email-attachments
CREATE POLICY "Users can upload their own attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'email-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'email-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "System can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-attachments');

CREATE POLICY "System can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-attachments');