-- Fix RLS policies for supplier_products to allow imports

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert their own supplier products" ON public.supplier_products;
DROP POLICY IF EXISTS "Users can update their own supplier products" ON public.supplier_products;
DROP POLICY IF EXISTS "Users can delete their own supplier products" ON public.supplier_products;
DROP POLICY IF EXISTS "Users can view their own supplier products" ON public.supplier_products;

-- Create new policies that work with edge functions
CREATE POLICY "Users can view their own supplier products"
ON public.supplier_products
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own supplier products"
ON public.supplier_products
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplier products"
ON public.supplier_products
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplier products"
ON public.supplier_products
FOR DELETE
USING (auth.uid() = user_id);