-- Add missing columns to price_monitoring table for Google Shopping data
ALTER TABLE public.price_monitoring 
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS rating numeric,
ADD COLUMN IF NOT EXISTS reviews_count integer;