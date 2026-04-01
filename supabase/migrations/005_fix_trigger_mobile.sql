-- =============================================
-- FIX: Update auth trigger to avoid mobile_number conflicts
-- =============================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update trigger function to handle mobile_number properly
CREATE OR REPLACE FUNCTION sync_user_to_customer()
RETURNS TRIGGER AS $$
DECLARE
    existing_customer_id INTEGER;
    existing_mobile VARCHAR(15);
BEGIN
    -- Check if customer exists by email
    SELECT customer_id, mobile_number INTO existing_customer_id, existing_mobile
    FROM public.customers
    WHERE email = NEW.email;

    IF existing_customer_id IS NOT NULL THEN
        -- Customer exists - just update auth_id
        UPDATE public.customers
        SET auth_id = NEW.id,
            updated_at = NOW()
        WHERE customer_id = existing_customer_id;
    ELSE
        -- New customer - create with temp mobile (will be updated by frontend)
        INSERT INTO public.customers (auth_id, email, mobile_number)
        VALUES (
            NEW.id,
            NEW.email,
            'TEMP_' || NEW.id::TEXT  -- Use auth_id to guarantee uniqueness
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_to_customer();
