-- Add shipping_cost column to shipment_tracking table
-- This allows tracking how much was paid for each shipment
ALTER TABLE public.shipment_tracking
ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) DEFAULT 0;

-- Index for date-based cost reporting
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_shipped_date
ON public.shipment_tracking(shipped_date);
