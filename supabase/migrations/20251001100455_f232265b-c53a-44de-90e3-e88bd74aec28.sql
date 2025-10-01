-- Add image URLs and enhanced categorization to product_analyses
ALTER TABLE product_analyses 
ADD COLUMN IF NOT EXISTS image_urls jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS mapped_category_id text,
ADD COLUMN IF NOT EXISTS mapped_category_name text,
ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS odoo_attributes jsonb DEFAULT '{}'::jsonb;

-- Create table for caching Odoo categories
CREATE TABLE IF NOT EXISTS odoo_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  odoo_category_id integer NOT NULL,
  category_name text NOT NULL,
  parent_id integer,
  parent_name text,
  full_path text NOT NULL,
  last_synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, odoo_category_id)
);

-- Enable RLS on odoo_categories
ALTER TABLE odoo_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for odoo_categories
CREATE POLICY "Users can view their own categories"
  ON odoo_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON odoo_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON odoo_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
  ON odoo_categories FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_odoo_categories_user_id ON odoo_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_odoo_categories_odoo_id ON odoo_categories(user_id, odoo_category_id);