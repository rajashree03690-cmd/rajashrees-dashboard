-- Add columns for enhanced shipment tracking
ALTER TABLE public.shipment_tracking
ADD COLUMN IF NOT EXISTS last_location text,
ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS raw_response jsonb;
