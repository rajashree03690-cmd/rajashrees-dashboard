-- ================================================================
-- PRODUCTION MIGRATION V2: Handle Duplicate Customers + Auth Links
-- Run this ONCE in Supabase SQL Editor (Production Database)
-- Handles duplicate email addresses intelligently
-- ================================================================

-- PART 1: Identify and Merge Duplicate Customers
-- ================================================================
DO $$
DECLARE
    v_email TEXT;
    v_primary_customer_id BIGINT;
    v_duplicate_customer_id BIGINT;
    v_merged_count INT := 0;
BEGIN
    RAISE NOTICE '🔄 Step 1: Merging duplicate customer records...';
    
    -- Find emails that have multiple customer records
    FOR v_email IN 
        SELECT email
        FROM public.customers
        WHERE email IS NOT NULL AND email != ''
        GROUP BY email
        HAVING COUNT(*) > 1
    LOOP
        -- Pick the PRIMARY customer (one with auth_id if exists, otherwise oldest)
        SELECT customer_id INTO v_primary_customer_id
        FROM public.customers
        WHERE email = v_email
        ORDER BY 
            CASE WHEN auth_id IS NOT NULL THEN 0 ELSE 1 END,  -- Prefer one with auth_id
            created_at ASC  -- Otherwise pick oldest
        LIMIT 1;
        
        RAISE NOTICE '  📌 Primary customer for %: %', v_email, v_primary_customer_id;
        
        -- Reassign all orders from duplicates to primary
        UPDATE public.orders
        SET customer_id = v_primary_customer_id
        WHERE customer_id IN (
            SELECT customer_id 
            FROM public.customers 
            WHERE email = v_email 
            AND customer_id != v_primary_customer_id
        );
        
        -- Delete duplicate customer records
        DELETE FROM public.customers
        WHERE email = v_email
        AND customer_id != v_primary_customer_id;
        
        v_merged_count := v_merged_count + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Merged % duplicate email groups', v_merged_count;
END $$;


-- PART 2: Link Customers to Auth Users
-- ================================================================
DO $$
DECLARE
    v_customer RECORD;
    v_auth_id UUID;
    v_fixed_count INT := 0;
BEGIN
    RAISE NOTICE '🔄 Step 2: Linking customers to auth users...';
    
    -- Loop through customers without auth_id
    FOR v_customer IN 
        SELECT customer_id, email, full_name, mobile_number
        FROM public.customers
        WHERE auth_id IS NULL 
        AND email IS NOT NULL
        AND email != ''
    LOOP
        -- Try to find matching auth user by email
        SELECT id INTO v_auth_id
        FROM auth.users
        WHERE email = v_customer.email;
        
        IF v_auth_id IS NOT NULL THEN
            -- Link the customer to the auth user
            UPDATE public.customers
            SET auth_id = v_auth_id,
                updated_at = NOW()
            WHERE customer_id = v_customer.customer_id;
            
            -- Also update orders to include auth_id
            UPDATE public.orders
            SET auth_id = v_auth_id
            WHERE customer_id = v_customer.customer_id
            AND auth_id IS NULL;
            
            v_fixed_count := v_fixed_count + 1;
            RAISE NOTICE '  ✅ Linked customer % (%) to auth', v_customer.customer_id, v_customer.email;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Linked % customers to auth users', v_fixed_count;
END $$;


-- PART 3: Install Robust Auth Trigger
-- ================================================================

-- Helper function
CREATE OR REPLACE FUNCTION public.extract_user_name(meta jsonb) 
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        meta->>'full_name',
        meta->>'name',
        meta->>'user_name',
        split_part(meta->>'email', '@', 1)
    );
END;
$$ LANGUAGE plpgsql;

-- Main trigger
CREATE OR REPLACE FUNCTION public.handle_new_user_signup() 
RETURNS TRIGGER AS $$
DECLARE
    existing_customer_id BIGINT;
BEGIN
    -- Check if customer already exists (should never have duplicates now)
    SELECT customer_id INTO existing_customer_id
    FROM public.customers
    WHERE email = NEW.email
    LIMIT 1;

    IF existing_customer_id IS NOT NULL THEN
        -- Link existing customer
        UPDATE public.customers
        SET 
            auth_id = NEW.id,
            updated_at = NOW()
        WHERE customer_id = existing_customer_id;
        
        -- Update orders
        UPDATE public.orders
        SET auth_id = NEW.id
        WHERE customer_id = existing_customer_id
        AND auth_id IS NULL;
        
        RAISE LOG 'Linked customer % to auth %', existing_customer_id, NEW.id;
    ELSE
        -- Create new customer
        INSERT INTO public.customers (
            auth_id,
            email,
            full_name,
            mobile_number,
            source
        )
        VALUES (
            NEW.id,
            NEW.email,
            public.extract_user_name(NEW.raw_user_meta_data),
            NEW.phone,
            'web'
        );
        
        RAISE LOG 'Created customer for %', NEW.email;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Install trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();


-- PART 4: Verification
-- ================================================================
SELECT 
    '✅ MIGRATION COMPLETE' as status,
    COUNT(*) FILTER (WHERE auth_id IS NOT NULL) as customers_with_auth,
    COUNT(*) FILTER (WHERE auth_id IS NULL) as customers_without_auth,
    COUNT(*) as total_customers
FROM public.customers;

-- Check for any remaining duplicates
SELECT 
    '⚠️ DUPLICATE CHECK' as check_type,
    email,
    COUNT(*) as duplicate_count
FROM public.customers
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;
