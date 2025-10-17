-- Autoriser les utilisateurs à supprimer leurs propres emails
CREATE POLICY "Users can delete their own inbox entries"
ON public.email_inbox
FOR DELETE
TO public
USING (auth.uid() = user_id);