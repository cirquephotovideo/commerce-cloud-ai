-- Fix 1: E-commerce Orders - Replace system policies with service role checks
DROP POLICY IF EXISTS "System can insert orders" ON public.ecommerce_orders;
DROP POLICY IF EXISTS "System can update orders" ON public.ecommerce_orders;

CREATE POLICY "Service role can insert orders"
  ON public.ecommerce_orders FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update orders"
  ON public.ecommerce_orders FOR UPDATE
  USING (auth.role() = 'service_role');

-- Fix 2: Supplier Sync Schedule - Replace system policy with user-scoped access
DROP POLICY IF EXISTS "System can manage sync schedules" ON public.supplier_sync_schedule;

CREATE POLICY "Service role can manage schedules"
  ON public.supplier_sync_schedule FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users manage own supplier schedules"
  ON public.supplier_sync_schedule FOR ALL
  USING (EXISTS (
    SELECT 1 FROM supplier_configurations
    WHERE supplier_configurations.id = supplier_sync_schedule.supplier_id
    AND supplier_configurations.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM supplier_configurations
    WHERE supplier_configurations.id = supplier_sync_schedule.supplier_id
    AND supplier_configurations.user_id = auth.uid()
  ));

-- Fix 3: User Subscriptions - Replace system policy with service role check
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.user_subscriptions;

CREATE POLICY "Service role manages subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');