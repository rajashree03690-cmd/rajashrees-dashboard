-- ========================================
-- CREATE SHIPMENTS FOR WEB ORDERS
-- Fix: Only WhatsApp orders have shipments currently
-- ========================================

-- Step 1: Check how many WEB orders don't have shipments
SELECT COUNT(*) as web_orders_without_shipments
FROM orders o
LEFT JOIN shipment_tracking st ON o.order_id = st.order_id
WHERE o.source = 'WEB'
  AND st.shipment_id IS NULL
  AND o.order_status NOT IN ('Cancelled', 'Returned');

-- Step 2: Preview what will be inserted
SELECT 
    o.order_id,
    o.source,
    o.order_status,
    o.created_at as order_date
FROM orders o
LEFT JOIN shipment_tracking st ON o.order_id = st.order_id
WHERE o.source = 'WEB'
  AND st.shipment_id IS NULL
  AND o.order_status NOT IN ('Cancelled', 'Returned')
LIMIT 10;

-- Step 3: CREATE SHIPMENTS FOR ALL WEB ORDERS
-- This will add shipment records for every WEB order that doesn't have one
INSERT INTO shipment_tracking (
    order_id,
    source,
    shipping_status,
    created_at,
    updated_at
)
SELECT 
    o.order_id,
    o.source,  -- Will be 'WEB'
    CASE 
        WHEN o.order_status = 'Delivered' THEN 'Delivered'
        WHEN o.order_status = 'Shipped' THEN 'Shipped'
        WHEN o.order_status IN ('Processing', 'Confirmed') THEN 'Yet to Ship'
        ELSE 'Yet to Ship'
    END as shipping_status,
    NOW() as created_at,
    NOW() as updated_at
FROM orders o
LEFT JOIN shipment_tracking st ON o.order_id = st.order_id
WHERE o.source = 'WEB'
  AND st.shipment_id IS NULL  -- Only orders without shipments
  AND o.order_status NOT IN ('Cancelled', 'Returned'); -- Skip cancelled/returned

-- Step 4: VERIFY the insert worked
SELECT 
    source,
    shipping_status,
    COUNT(*) as count
FROM shipment_tracking
GROUP BY source, shipping_status
ORDER BY source, shipping_status;

-- Expected result:
-- source     | shipping_status | count
-- WEB        | Yet to Ship     | ~1000+
-- WhatsApp   | Yet to Ship     | 87
-- WhatsApp   | Shipped         | 2682
-- etc...

-- Step 5: Check sample WEB shipments
SELECT 
    order_id,
    source,
    shipping_status,
    tracking_number,
    created_at
FROM shipment_tracking
WHERE source = 'WEB'
ORDER BY created_at DESC
LIMIT 20;

-- ========================================
-- SUCCESS INDICATORS:
-- 1. shipment_tracking should now have WEB + WhatsApp rows
-- 2. Total count should be MUCH higher than 2769
-- 3. Source filter in dashboard will now show WEB orders!
-- ========================================

-- ========================================
-- OPTIONAL: Auto-create shipments for future orders
-- ========================================

-- Trigger to automatically create shipment when order is created
CREATE OR REPLACE FUNCTION auto_create_shipment()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create shipment for non-cancelled orders
    IF NEW.order_status NOT IN ('Cancelled', 'Returned') THEN
        INSERT INTO shipment_tracking (
            order_id,
            source,
            shipping_status,
            created_at,
            updated_at
        ) VALUES (
            NEW.order_id,
            NEW.source,
            'Yet to Ship',
            NOW(),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_create_shipment ON orders;

CREATE TRIGGER trg_auto_create_shipment
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION auto_create_shipment();

-- Verify trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_auto_create_shipment';
