-- Corriger le search_path de la fonction créée précédemment
CREATE OR REPLACE FUNCTION sync_updated_at_with_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated := COALESCE(NEW.last_updated, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;