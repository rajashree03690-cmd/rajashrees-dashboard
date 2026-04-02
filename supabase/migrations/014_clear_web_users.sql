-- =============================================
-- COMPREHENSIVE CLEANUP: Clear all web users
-- Handles ALL foreign key constraints properly
-- =============================================

-- Step 1: Drop broken triggers
DROP TRIGGER IF EXISTS update_queries_updated_at ON queries;
DROP TRIGGER IF EXISTS update_queries_modtime ON queries;
DROP TRIGGER IF EXISTS set_updated_at ON queries;
DROP TRIGGER IF EXISTS update_updated_at_trigger ON queries;
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;

-- Step 2: Get list of web customer IDs for clarity
DO $$
DECLARE
    web_users_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO web_users_count
    FROM customers
    WHERE source = 'web';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Web users to delete: %', web_users_count;
    RAISE NOTICE '============================================';
END $$;

-- Step 3: Delete/unlink ALL foreign key references

-- Delete shipment tracking (references orders)
DELETE FROM shipment_tracking
WHERE order_id IN (
    SELECT order_id FROM orders 
    WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web')
);

-- Delete order items first (references orders)
DELETE FROM order_items 
WHERE order_id IN (
    SELECT order_id FROM orders 
    WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web')
);

-- Delete orders
DELETE FROM orders 
WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web');

-- Delete cart items
DELETE FROM cart_item 
WHERE cart_id IN (
    SELECT cart_id FROM cart 
    WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web')
);

-- Delete carts
DELETE FROM cart 
WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web');

-- Delete wishlist items
DELETE FROM wishlist_item 
WHERE wishlist_id IN (
    SELECT wishlist_id FROM wishlist 
    WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web')
);

-- Delete wishlists
DELETE FROM wishlist 
WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web');

-- Delete addresses
DELETE FROM addresses 
WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web');

-- Unlink queries (preserve query data)
UPDATE queries
SET customer_id = NULL
WHERE customer_id IN (SELECT customer_id FROM customers WHERE source = 'web');

-- Step 4: Delete from auth.users (will cascade to customers if FK exists)
DELETE FROM auth.users
WHERE id IN (
    SELECT auth_id 
    FROM customers 
    WHERE source = 'web' AND auth_id IS NOT NULL
);

-- Step 5: Delete remaining customer records
DELETE FROM customers
WHERE source = 'web';

-- Step 6: Verify cleanup
DO $$
DECLARE
    remaining_web_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_web_users
    FROM customers
    WHERE source = 'web';
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Remaining web users: %', remaining_web_users;
    RAISE NOTICE '============================================';
    
    IF remaining_web_users = 0 THEN
        RAISE NOTICE '✅ SUCCESS: All web users and related data cleared!';
    ELSE
        RAISE WARNING 'Some web users remain: %', remaining_web_users;
    END IF;
END $$;
