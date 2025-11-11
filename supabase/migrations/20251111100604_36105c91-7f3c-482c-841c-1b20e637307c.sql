-- Ajouter une policy DELETE pour permettre aux utilisateurs de supprimer leurs propres alertes
CREATE POLICY "Users can delete their own alerts"
ON user_alerts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);