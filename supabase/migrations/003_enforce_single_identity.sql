-- ================================================================
-- PRODUCTION MIGRATION V3: Enforce Single Identity
-- Merges any remaining duplicate customers and enforces a unique constraint
-- ================================================================

-- PART 1: Identify and Merge Duplicate Customers (Safety Pass)
-- ================================================================
DO $$
DECLARE
    v_email TEXT;
    v_primary_customer_id BIGINT;
    v_duplicate_customer_id BIGINT;
    v_merged_count INT := 0;
BEGIN
    RAISE NOTICE '🔄 Merging any remaining duplicate customer records before enforcing constraint...';
    
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
            CASE WHEN auth_id IS NOT NULL THEN 0 ELSE 1 END,
            created_at ASC
        LIMIT 1;
        
        -- Reassign all orders from duplicates to primary
        UPDATE public.orders
        SET customer_id = v_primary_customer_id
        WHERE customer_id IN (
            SELECT customer_id 
            FROM public.customers 
            WHERE email = v_email 
            AND customer_id != v_primary_customer_id
        );
        
        -- Reassign cart
        UPDATE public.cart
        SET customer_id = v_primary_customer_id
        WHERE customer_id IN (
            SELECT customer_id 
            FROM public.customers 
            WHERE email = v_email 
            AND customer_id != v_primary_customer_id
        );

        -- Reassign addresses
        UPDATE public.addresses
        SET customer_id = v_primary_customer_id
        WHERE customer_id IN (
            SELECT customer_id 
            FROM public.customers 
            WHERE email = v_email 
            AND customer_id != v_primary_customer_id
        );

        -- Reassign wishlist
        UPDATE public.wishlist
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


-- PART 2: Enforce Unique Identity 
-- ================================================================
-- First, ensure the correct trigger is the ONLY trigger active (from V2 migration)
-- Drop the old trigger if it somehow survived (from 002 safe additive migration)
DROP FUNCTION IF EXISTS public.sync_user_to_customer() CASCADE;

-- Ensure our good trigger from V2 is active
CREATE OR REPLACE FUNCTION public.handle_new_user_signup() 
RETURNS TRIGGER AS $$
DECLARE
    existing_customer_id BIGINT;
BEGIN
    -- Search by email first to prevent duplicates
    SELECT customer_id INTO existing_customer_id
    FROM public.customers
    WHERE email = NEW.email
    LIMIT 1;

    IF existing_customer_id IS NOT NULL THEN
        -- Link existing customer (e.g. WhatsApp customer) to this new auth_id
        UPDATE public.customers
        SET 
            auth_id = NEW.id,
            source = 'web', -- they are now a web user too
            updated_at = NOW()
        WHERE customer_id = existing_customer_id;
        
        -- Update any orders that might have been missing auth_id
        UPDATE public.orders
        SET auth_id = NEW.id
        WHERE customer_id = existing_customer_id
        AND auth_id IS NULL;
    ELSE
        -- Create completely new customer
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
            COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name',
                NEW.raw_user_meta_data->>'user_name',
                split_part(NEW.email, '@', 1)
            ),
            NEW.phone,
            'web'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure ONLY handle_new_user_signup fires specifically
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();


-- Now add the actual unique constraint so the database physically blocks duplicates from any source!
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique 
ON public.customers (email) 
WHERE email IS NOT NULL AND email != '';

RAISE NOTICE '✅ Unique email constraint enforced successfully!';
