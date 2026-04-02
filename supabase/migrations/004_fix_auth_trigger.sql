-- =============================================
-- FIX: Update auth trigger to handle existing customers
-- =============================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Update trigger function to properly handle customer updates
CREATE OR REPLACE FUNCTION sync_user_to_customer()
RETURNS TRIGGER AS $$
DECLARE
    existing_customer_id INTEGER;
BEGIN
    -- Check if customer exists by email (from pre-signup check)
    SELECT customer_id INTO existing_customer_id
    FROM public.customers
    WHERE email = NEW.email;

    IF existing_customer_id IS NOT NULL THEN
        -- Update existing customer with auth_id
        UPDATE public.customers
        SET auth_id = NEW.id,
            updated_at = NOW()
        WHERE customer_id = existing_customer_id;
    ELSE
        -- Create new customer
        INSERT INTO public.customers (auth_id, email, mobile_number)
        VALUES (
            NEW.id,
            NEW.email,
            generate_temp_mobile()
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
