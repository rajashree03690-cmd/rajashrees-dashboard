-- Migration 017 Patch: Shipment Tracking Configuration
-- Use this to configure the EXISTING shipment_tracking table

-- 1. Ensure RLS is enabled on the existing table
ALTER TABLE public.shipment_tracking ENABLE ROW LEVEL SECURITY;

-- 2. Apply Custom RLS Policies for customers
-- Allows customers to view tracking details for their own orders
DROP POLICY IF EXISTS "Users can view tracking for own orders" ON public.shipment_tracking;
CREATE POLICY "Users can view tracking for own orders"
    ON public.shipment_tracking FOR SELECT
    USING (
        order_id IN (
            SELECT order_id FROM public.orders 
            WHERE customer_id IN (SELECT customer_id FROM public.customers WHERE auth_id = auth.uid())
        )
    );

-- 3. Enable Realtime for the existing table
-- This allows the OrderCard.tsx to update instantly when a tracking record is added/updated
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Add tracking table to realtime if not already there
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipment_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- 4. Note: shipping_status defaults to 'pending' in existing schema.
-- Ensure updated_at is handled by a trigger if desired
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = (NOW() AT TIME ZONE 'utc');
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at ON public.shipment_tracking;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.shipment_tracking
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();
