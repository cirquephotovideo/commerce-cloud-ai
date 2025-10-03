-- Create contact_messages table
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text NOT NULL CHECK (char_length(sender_name) >= 2 AND char_length(sender_name) <= 100),
  sender_email text NOT NULL CHECK (char_length(sender_email) <= 255),
  subject text CHECK (char_length(subject) <= 200),
  message text NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 2000),
  status text DEFAULT 'new' CHECK (status IN ('new', 'processing', 'resolved')),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view all messages
CREATE POLICY "Super admins can view all contact messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Policy: Super admins can update messages (mark as processed)
CREATE POLICY "Super admins can update contact messages"
ON public.contact_messages
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- Policy: Anyone can insert (form submission)
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Create index for quick lookups
CREATE INDEX idx_contact_messages_created_at ON public.contact_messages(created_at DESC);
CREATE INDEX idx_contact_messages_status ON public.contact_messages(status);
CREATE INDEX idx_contact_messages_email ON public.contact_messages(sender_email);