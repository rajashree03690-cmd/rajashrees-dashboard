-- ========================================
-- SHIPMENT TRACKING - ADD SOURCE COLUMN
-- Run this in Supabase SQL Editor
-- ========================================

-- Step 1: Add source column only
ALTER TABLE shipment_tracking 
ADD COLUMN IF NOT EXISTS source TEXT;

-- Step 2: Populate source from orders table
UPDATE shipment_tracking st
SET source = o.source
FROM orders o
WHERE st.order_id = o.order_id
  AND st.source IS NULL; -- Only update if not already set

-- Step 3: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_source 
ON shipment_tracking(source);

-- Step 4: Create function to auto-populate source
CREATE OR REPLACE FUNCTION populate_shipment_source()
RETURNS TRIGGER AS $$
BEGIN
    -- Get source from orders table
    SELECT o.source
    INTO NEW.source
    FROM orders o
    WHERE o.order_id = NEW.order_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to auto-populate on INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_populate_shipment_source ON shipment_tracking;

CREATE TRIGGER trigger_populate_shipment_source
BEFORE INSERT OR UPDATE ON shipment_tracking
FOR EACH ROW
WHEN (NEW.source IS NULL)
EXECUTE FUNCTION populate_shipment_source();

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- 1. Check if column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipment_tracking' 
  AND column_name = 'source';

-- 2. Count shipments by source
SELECT 
    source,
    COUNT(*) as count
FROM shipment_tracking
GROUP BY source
ORDER BY count DESC;

-- 3. Check for any NULL sources (should be 0 if migration worked)
SELECT COUNT(*) as null_source_count
FROM shipment_tracking
WHERE source IS NULL;

-- 4. Sample web orders (should show your web shipments!)
SELECT 
    order_id,
    source,
    shipping_status,
    tracking_number
FROM shipment_tracking
WHERE source = 'WEB'
LIMIT 10;

-- ========================================
-- SUCCESS! Now you can filter by source
-- ========================================
