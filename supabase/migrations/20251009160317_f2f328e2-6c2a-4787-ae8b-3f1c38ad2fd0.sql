-- Changer rsgp_valide de boolean à text pour supporter 3 états
ALTER TABLE public.rsgp_compliance 
ALTER COLUMN rsgp_valide TYPE text USING CASE 
  WHEN rsgp_valide = true THEN 'Oui'
  WHEN rsgp_valide = false THEN 'Non conforme'
  ELSE 'En attente'
END;

-- Ajouter une contrainte pour valider les valeurs
ALTER TABLE public.rsgp_compliance 
ADD CONSTRAINT rsgp_valide_check 
CHECK (rsgp_valide IN ('Oui', 'En attente', 'Non conforme'));