-- Table pour stocker les références aux File Search Stores Gemini
CREATE TABLE gemini_file_search_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  gemini_store_id TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  product_count INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_gemini_stores_user_unique ON gemini_file_search_stores(user_id);
CREATE INDEX idx_gemini_stores_status ON gemini_file_search_stores(sync_status);

-- RLS Policies
ALTER TABLE gemini_file_search_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stores" 
  ON gemini_file_search_stores FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stores" 
  ON gemini_file_search_stores FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stores" 
  ON gemini_file_search_stores FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_gemini_stores_updated_at
  BEFORE UPDATE ON gemini_file_search_stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();