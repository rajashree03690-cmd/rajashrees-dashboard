-- =============================================
-- COMPREHENSIVE FIX: Duplicate Customers Cleanup
-- Based on actual production schema
-- Enforces: 1 email = 1 web customer, 1 phone = 1 whatsapp customer
-- =============================================

-- Step 1: Show current duplicates
DO $$
DECLARE
    web_email_dups INTEGER;
    whatsapp_phone_dups INTEGER;
    auth_id_dups INTEGER;
BEGIN
    -- Count web duplicates (same email)
    SELECT COUNT(*) INTO web_email_dups
    FROM (
        SELECT email
        FROM customers
        WHERE source = 'web' AND email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Count whatsapp duplicates (same mobile)
    SELECT COUNT(*) INTO whatsapp_phone_dups
    FROM (
        SELECT mobile_number
        FROM customers
        WHERE source = 'whatsapp' AND mobile_number IS NOT NULL
        GROUP BY mobile_number
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Count auth_id duplicates
    SELECT COUNT(*) INTO auth_id_dups
    FROM (
        SELECT auth_id
        FROM customers
        WHERE auth_id IS NOT NULL
        GROUP BY auth_id
        HAVING COUNT(*) > 1
    ) dups;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'BEFORE CLEANUP:';
    RAISE NOTICE 'Web duplicates (by email): %', web_email_dups;
    RAISE NOTICE 'WhatsApp duplicates (by phone): %', whatsapp_phone_dups;
    RAISE NOTICE 'Auth ID duplicates: %', auth_id_dups;
    RAISE NOTICE '============================================';
END $$;

-- Step 2: Reassign ORDERS from duplicate customers to oldest customer
WITH duplicate_mapping AS (
    SELECT 
        c1.customer_id as old_customer_id,
        c2.customer_id as new_customer_id
    FROM customers c1
    CROSS JOIN LATERAL (
        SELECT MIN(customer_id) as customer_id
        FROM customers c3
        WHERE 
            -- Match by email for web source
            (c1.source = 'web' AND c3.source = 'web' AND c1.email = c3.email AND c1.email IS NOT NULL)
            OR
            -- Match by mobile for whatsapp source
            (c1.source = 'whatsapp' AND c3.source = 'whatsapp' AND c1.mobile_number = c3.mobile_number AND c1.mobile_number IS NOT NULL)
            OR
            -- Match by auth_id if same
            (c1.auth_id IS NOT NULL AND c3.auth_id = c1.auth_id)
    ) c2
    WHERE c1.customer_id != c2.customer_id
)
UPDATE orders
SET customer_id = dm.new_customer_id
FROM duplicate_mapping dm
WHERE orders.customer_id = dm.old_customer_id;

-- Step 3: Reassign CART from duplicate customers
WITH duplicate_mapping AS (
    SELECT 
        c1.customer_id as old_customer_id,
        c2.customer_id as new_customer_id
    FROM customers c1
    CROSS JOIN LATERAL (
        SELECT MIN(customer_id) as customer_id
        FROM customers c3
        WHERE 
            (c1.source = 'web' AND c3.source = 'web' AND c1.email = c3.email AND c1.email IS NOT NULL)
            OR
            (c1.source = 'whatsapp' AND c3.source = 'whatsapp' AND c1.mobile_number = c3.mobile_number AND c1.mobile_number IS NOT NULL)
            OR
            (c1.auth_id IS NOT NULL AND c3.auth_id = c1.auth_id)
    ) c2
    WHERE c1.customer_id != c2.customer_id
)
UPDATE cart
SET customer_id = dm.new_customer_id
FROM duplicate_mapping dm
WHERE cart.customer_id = dm.old_customer_id;

-- Step 4: Reassign WISHLIST from duplicate customers
WITH duplicate_mapping AS (
    SELECT 
        c1.customer_id as old_customer_id,
        c2.customer_id as new_customer_id
    FROM customers c1
    CROSS JOIN LATERAL (
        SELECT MIN(customer_id) as customer_id
        FROM customers c3
        WHERE 
            (c1.source = 'web' AND c3.source = 'web' AND c1.email = c3.email AND c1.email IS NOT NULL)
            OR
            (c1.source = 'whatsapp' AND c3.source = 'whatsapp' AND c1.mobile_number = c3.mobile_number AND c1.mobile_number IS NOT NULL)
            OR
            (c1.auth_id IS NOT NULL AND c3.auth_id = c1.auth_id)
    ) c2
    WHERE c1.customer_id != c2.customer_id
)
UPDATE wishlist
SET customer_id = dm.new_customer_id
FROM duplicate_mapping dm
WHERE wishlist.customer_id = dm.old_customer_id;


-- Step 5: Delete WEB duplicates (NOW safe - no foreign keys)
DELETE FROM customers
WHERE customer_id IN (
    SELECT customer_id
    FROM (
        SELECT 
            customer_id,
            ROW_NUMBER() OVER (
                PARTITION BY email, source 
                ORDER BY created_at ASC, customer_id ASC
            ) as rn
        FROM customers
        WHERE source = 'web' AND email IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Step 6: Delete WHATSAPP duplicates (NOW safe - no foreign keys)
DELETE FROM customers
WHERE customer_id IN (
    SELECT customer_id
    FROM (
        SELECT 
            customer_id,
            ROW_NUMBER() OVER (
                PARTITION BY mobile_number, source 
                ORDER BY created_at ASC, customer_id ASC
            ) as rn
        FROM customers
        WHERE source = 'whatsapp' AND mobile_number IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Step 7: Delete AUTH_ID duplicates (NOW safe - no foreign keys)
DELETE FROM customers
WHERE customer_id IN (
    SELECT customer_id
    FROM (
        SELECT 
            customer_id,
            ROW_NUMBER() OVER (
                PARTITION BY auth_id 
                ORDER BY created_at ASC, customer_id ASC
            ) as rn
        FROM customers
        WHERE auth_id IS NOT NULL
    ) ranked
    WHERE rn > 1
);

-- Step 8: Add UNIQUE index for auth_id (NOW safe to create)
DROP INDEX IF EXISTS customers_auth_id_unique;
CREATE UNIQUE INDEX customers_auth_id_unique 
ON customers (auth_id) 
WHERE auth_id IS NOT NULL;

-- Step 9: Add UNIQUE constraint for WEB source (email must be unique)
DROP INDEX IF EXISTS customers_web_email_unique;
CREATE UNIQUE INDEX customers_web_email_unique 
ON customers (email) 
WHERE source = 'web' AND email IS NOT NULL;

-- Step 10: Add UNIQUE constraint for WHATSAPP source (mobile must be unique)
DROP INDEX IF EXISTS customers_whatsapp_mobile_unique;
CREATE UNIQUE INDEX customers_whatsapp_mobile_unique 
ON customers (mobile_number) 
WHERE source = 'whatsapp' AND mobile_number IS NOT NULL;

-- Step 11: Verify cleanup success
DO $$
DECLARE
    web_email_dups INTEGER;
    whatsapp_phone_dups INTEGER;
    auth_id_dups INTEGER;
    total_customers INTEGER;
BEGIN
    -- Count web duplicates (same email)
    SELECT COUNT(*) INTO web_email_dups
    FROM (
        SELECT email
        FROM customers
        WHERE source = 'web' AND email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Count whatsapp duplicates (same mobile)
    SELECT COUNT(*) INTO whatsapp_phone_dups
    FROM (
        SELECT mobile_number
        FROM customers
        WHERE source = 'whatsapp' AND mobile_number IS NOT NULL
        GROUP BY mobile_number
        HAVING COUNT(*) > 1
    ) dups;
    
    -- Count auth_id duplicates
    SELECT COUNT(*) INTO auth_id_dups
    FROM (
        SELECT auth_id
        FROM customers
        WHERE auth_id IS NOT NULL
        GROUP BY auth_id
        HAVING COUNT(*) > 1
    ) dups;
    
    SELECT COUNT(*) INTO total_customers FROM customers;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'AFTER CLEANUP:';
    RAISE NOTICE 'Total customers: %', total_customers;
    RAISE NOTICE 'Web duplicates (by email): %', web_email_dups;
    RAISE NOTICE 'WhatsApp duplicates (by phone): %', whatsapp_phone_dups;
    RAISE NOTICE 'Auth ID duplicates: %', auth_id_dups;
    RAISE NOTICE '============================================';
    
    IF web_email_dups > 0 OR whatsapp_phone_dups > 0 OR auth_id_dups > 0 THEN
        RAISE EXCEPTION 'Cleanup failed: duplicates still remain';
    ELSE
        RAISE NOTICE '✅ SUCCESS: All duplicates removed, constraints applied';
    END IF;
END $$;
