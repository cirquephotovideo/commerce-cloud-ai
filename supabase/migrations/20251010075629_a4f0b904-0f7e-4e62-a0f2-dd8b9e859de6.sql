-- Phase 1: Automatic Synchronization Tables and Triggers (CORRECTED)

-- Create supplier_sync_schedule table
CREATE TABLE IF NOT EXISTS public.supplier_sync_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.supplier_configurations(id) ON DELETE CASCADE NOT NULL,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'scheduled' CHECK (sync_status IN ('scheduled', 'running', 'completed', 'failed')),
  products_updated INT DEFAULT 0,
  products_added INT DEFAULT 0,
  price_changes INT DEFAULT 0,
  stock_changes INT DEFAULT 0,
  sync_duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on supplier_sync_schedule
ALTER TABLE public.supplier_sync_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies for supplier_sync_schedule
CREATE POLICY "Users can view their own sync schedules"
ON public.supplier_sync_schedule
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_configurations
    WHERE supplier_configurations.id = supplier_sync_schedule.supplier_id
    AND supplier_configurations.user_id = auth.uid()
  )
);

CREATE POLICY "System can manage sync schedules"
ON public.supplier_sync_schedule
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_supplier_sync_schedule_supplier_id ON public.supplier_sync_schedule(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_sync_schedule_next_sync ON public.supplier_sync_schedule(next_sync_at) WHERE sync_status = 'scheduled';

-- Add last_synced_at to supplier_configurations if not exists
ALTER TABLE public.supplier_configurations 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Create function to notify price changes (CORRECTED)
CREATE OR REPLACE FUNCTION public.notify_supplier_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  price_change_percentage NUMERIC;
  supplier_name TEXT;
BEGIN
  -- Calculate price change percentage
  IF OLD.purchase_price > 0 THEN
    price_change_percentage := ABS((NEW.purchase_price - OLD.purchase_price) / OLD.purchase_price * 100);
  ELSE
    price_change_percentage := 100;
  END IF;

  -- Only notify if change is significant (>10%)
  IF price_change_percentage > 10 THEN
    -- Get supplier name
    SELECT name INTO supplier_name
    FROM supplier_configurations
    WHERE id = NEW.supplier_id;

    -- Insert notification (will be handled by Phase 5)
    -- For now, just log it
    RAISE NOTICE 'Price change detected for product % from supplier %: % -> % (% percent change)',
      NEW.name, supplier_name, OLD.purchase_price, NEW.purchase_price, ROUND(price_change_percentage, 2);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for price change notifications
DROP TRIGGER IF EXISTS supplier_price_change_notification ON public.supplier_products;
CREATE TRIGGER supplier_price_change_notification
AFTER UPDATE ON public.supplier_products
FOR EACH ROW
WHEN (OLD.purchase_price IS DISTINCT FROM NEW.purchase_price)
EXECUTE FUNCTION public.notify_supplier_price_change();

-- Phase 2: Auto-enrichment tracking
ALTER TABLE public.product_analyses
ADD COLUMN IF NOT EXISTS last_auto_enrichment_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_enrichment_count INT DEFAULT 0;

-- Phase 3: Auto-export rules table
CREATE TABLE IF NOT EXISTS public.auto_export_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform_type TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  conditions JSONB DEFAULT '{}',
  sync_frequency TEXT DEFAULT 'on_new' CHECK (sync_frequency IN ('on_new', 'hourly', 'daily', 'weekly')),
  last_sync_at TIMESTAMPTZ,
  products_exported INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on auto_export_rules
ALTER TABLE public.auto_export_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for auto_export_rules
CREATE POLICY "Users can manage their own export rules"
ON public.auto_export_rules
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add export tracking to product_analyses
ALTER TABLE public.product_analyses
ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS exported_to_platforms JSONB DEFAULT '[]';

-- Phase 5: User alerts table
CREATE TABLE IF NOT EXISTS public.user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_change', 'new_product', 'enrichment_complete', 'low_stock', 'sync_error', 'export_complete')),
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_product_id UUID,
  related_supplier_id UUID REFERENCES public.supplier_configurations(id) ON DELETE SET NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_alerts
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_alerts
CREATE POLICY "Users can view their own alerts"
ON public.user_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
ON public.user_alerts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create alerts"
ON public.user_alerts
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON public.user_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_alerts_is_read ON public.user_alerts(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_user_alerts_created_at ON public.user_alerts(created_at DESC);

-- Add updated_at trigger to new tables
CREATE TRIGGER update_supplier_sync_schedule_updated_at
BEFORE UPDATE ON public.supplier_sync_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_auto_export_rules_updated_at
BEFORE UPDATE ON public.auto_export_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();