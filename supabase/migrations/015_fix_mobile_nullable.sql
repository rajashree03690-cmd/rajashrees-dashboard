-- =============================================
-- FIX: Allow NULL mobile_number for web users
-- Web source: 1 email = 1 customer
-- WhatsApp source: 1 phone = 1 customer
-- =============================================

-- Step 1: Drop the global unique constraint on mobile_number
ALTER TABLE customers 
ALTER COLUMN mobile_number DROP NOT NULL;

-- Step 2: Drop any existing unique constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'customers_mobile_number_key'
    ) THEN
        ALTER TABLE customers DROP CONSTRAINT customers_mobile_number_key;
    END IF;
END $$;

-- Step 3: The whatsapp unique constraint already exists from migration 013
-- customers_whatsapp_mobile_unique index handles whatsapp uniqueness
-- No global constraint needed - web users can have duplicate/null mobiles

-- Step 4: Verify
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ mobile_number is now nullable';
    RAISE NOTICE '✅ Web users: email must be unique';
    RAISE NOTICE '✅ WhatsApp users: mobile must be unique';
    RAISE NOTICE '============================================';
END $$;
