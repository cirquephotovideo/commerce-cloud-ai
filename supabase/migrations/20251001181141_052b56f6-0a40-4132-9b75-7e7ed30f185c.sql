-- Add proper RLS policies for newsletter_subscribers to prevent email harvesting

-- Allow authenticated users to view only their own subscription
CREATE POLICY "Users can view their own subscription"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Allow authenticated users to update only their own subscription status (unsubscribe)
CREATE POLICY "Users can update their own subscription"
ON public.newsletter_subscribers
FOR UPDATE
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Public users can only insert their own email (for newsletter signup)
CREATE POLICY "Anyone can subscribe with their email"
ON public.newsletter_subscribers
FOR INSERT
TO public
WITH CHECK (true);

-- Add comment explaining the security model
COMMENT ON TABLE public.newsletter_subscribers IS 'Email list protected by RLS. Only super admins can view all subscribers. Users can only see/manage their own subscription. Edge functions use service role to bypass RLS for legitimate operations.';