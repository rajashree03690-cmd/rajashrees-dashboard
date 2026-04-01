-- Check what source values are currently in shipment_tracking
SELECT 
    source,
    COUNT(*) as count
FROM shipment_tracking
GROUP BY source
ORDER BY count DESC;

-- Check if the UPDATE ran correctly by comparing with orders table
SELECT 
    'shipment_tracking' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN source IS NULL THEN 1 END) as null_source,
    COUNT(CASE WHEN source = 'WEB' THEN 1 END) as web_count,
    COUNT(CASE WHEN source = 'WhatsApp' THEN 1 END) as whatsapp_count
FROM shipment_tracking

UNION ALL

SELECT 
    'orders' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN source IS NULL THEN 1 END) as null_source,
    COUNT(CASE WHEN source = 'WEB' THEN 1 END) as web_count,
    COUNT(CASE WHEN source = 'WhatsApp' THEN 1 END) as whatsapp_count
FROM orders;

-- Find which shipments don't have source populated
SELECT 
    st.order_id,
    st.source as shipment_source,
    o.source as order_source
FROM shipment_tracking st
LEFT JOIN orders o ON st.order_id = o.order_id
WHERE st.source IS NULL
LIMIT 10;

-- Try to manually update again
UPDATE shipment_tracking st
SET source = o.source
FROM orders o
WHERE st.order_id = o.order_id;

-- Verify after update
SELECT 
    source,
    COUNT(*) as count
FROM shipment_tracking
GROUP BY source;
