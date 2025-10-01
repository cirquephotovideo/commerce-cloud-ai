-- Ajouter les nouveaux rôles à l'enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'moderator';
