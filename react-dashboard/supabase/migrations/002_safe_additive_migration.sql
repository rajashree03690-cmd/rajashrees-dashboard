-- =============================================
-- ADDITIVE MIGRATION: For existing production database
-- SAFE: Only adds missing constraints, triggers, and functions
-- =============================================

-- =============================================
-- 1. ADD MISSING CONSTRAINTS TO EXISTING TABLES
-- =============================================

-- Ensure customers.mobile_number allows temporary values
-- (Already has constraint, skip if exists)

-- Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_auth_id ON public.customers(auth_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON public.addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_addresses_default ON public.addresses(customer_id, is_default);
CREATE INDEX IF NOT EXISTS idx_cart_customer ON public.cart(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_item(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);

-- =============================================
-- 2. ENSURE RPC FUNCTION EXISTS
-- =============================================

-- Function to generate temporary mobile number
CREATE OR REPLACE FUNCTION generate_temp_mobile()
RETURNS VARCHAR(15) AS $$
BEGIN
    RETURN 'TEMP_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to set default address (atomic transaction)
CREATE OR REPLACE FUNCTION set_default_address(p_address_id BIGINT, p_customer_id BIGINT)
RETURNS VOID AS $$
BEGIN
    -- Unset all defaults for this customer
    UPDATE public.addresses
    SET is_default = FALSE
    WHERE customer_id = p_customer_id;
    
    -- Set the selected address as default
    UPDATE public.addresses
    SET is_default = TRUE
    WHERE address_id = p_address_id
      AND customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 3. TRIGGER: AUTO-SYNC auth.users → customers
-- =============================================

-- Trigger function to sync auth.users to customers
CREATE OR REPLACE FUNCTION sync_user_to_customer()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if auth_id doesn't already exist
    INSERT INTO public.customers (auth_id, email, mobile_number, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        generate_temp_mobile(),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (auth_id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.customers.full_name);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_to_customer();

-- =============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on tables if not already enabled
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Users can update their own customer record" ON public.customers;
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can insert their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can update their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can delete their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can view their own cart" ON public.cart;
DROP POLICY IF EXISTS "Users can modify their own cart" ON public.cart;
DROP POLICY IF EXISTS "Users can view their own cart items" ON public.cart_item;
DROP POLICY IF EXISTS "Users can modify their own cart items" ON public.cart_item;
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view their own shipment tracking" ON public.shipment_tracking;

-- Customers policies
CREATE POLICY "Users can view their own customer record"
    ON public.customers
    FOR SELECT
    USING (auth.uid() = auth_id);

CREATE POLICY "Users can update their own customer record"
    ON public.customers
    FOR UPDATE
    USING (auth.uid() = auth_id);

-- Addresses policies
CREATE POLICY "Users can view their own addresses"
    ON public.addresses
    FOR SELECT
    USING (
        customer_id IN (
            SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own addresses"
    ON public.addresses
    FOR INSERT
    WITH CHECK (
        customer_id IN (
            SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own addresses"
    ON public.addresses
    FOR UPDATE
    USING (
        customer_id IN (
            SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own addresses"
    ON public.addresses
    FOR DELETE
    USING (
        customer_id IN (
            SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()
        )
    );

-- Cart policies
CREATE POLICY "Users can view their own cart"
    ON public.cart
    FOR SELECT
    USING (
        customer_id IN (
            SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()
        )
    );

CREATE POLICY "Users can modify their own cart"
    ON public.cart
    FOR ALL
    USING (
        customer_id IN (
            SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()
        )
    );

-- Cart items policies
CREATE POLICY "Users can view their own cart items"
    ON public.cart_item
    FOR SELECT
    USING (
        cart_id IN (
            SELECT c.cart_id FROM public.cart c
            JOIN public.customers cu ON c.customer_id = cu.customer_id
            WHERE cu.auth_id = auth.uid()
        )
    );

CREATE POLICY "Users can modify their own cart items"
    ON public.cart_item
    FOR ALL
    USING (
        cart_id IN (
            SELECT c.cart_id FROM public.cart c
            JOIN public.customers cu ON c.customer_id = cu.customer_id
            WHERE cu.auth_id = auth.uid()
        )
    );

-- Orders policies
CREATE POLICY "Users can view their own orders"
    ON public.orders
    FOR SELECT
    USING (
        customer_id IN (
            SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()
        )
    );

-- Order items policies
CREATE POLICY "Users can view their own order items"
    ON public.order_items
    FOR SELECT
    USING (
        order_id IN (
            SELECT o.order_id FROM public.orders o
            JOIN public.customers c ON o.customer_id = c.customer_id
            WHERE c.auth_id = auth.uid()
        )
    );

-- Shipment tracking policies
CREATE POLICY "Users can view their own shipment tracking"
    ON public.shipment_tracking
    FOR SELECT
    USING (
        order_id IN (
            SELECT o.order_id FROM public.orders o
            JOIN public.customers c ON o.customer_id = c.customer_id
            WHERE c.auth_id = auth.uid()
        )
    );

-- =============================================
-- 5. HELPER FUNCTIONS
-- =============================================

-- Function to get or create active cart for a customer
CREATE OR REPLACE FUNCTION get_or_create_cart(p_customer_id BIGINT)
RETURNS UUID AS $$
DECLARE
    v_cart_id UUID;
BEGIN
    -- Find active cart
    SELECT cart_id INTO v_cart_id
    FROM public.cart
    WHERE customer_id = p_customer_id
      AND status = 'active'
    LIMIT 1;
    
    -- Create if doesn't exist
    IF v_cart_id IS NULL THEN
        INSERT INTO public.cart (customer_id, status)
        VALUES (p_customer_id, 'active')
        RETURNING cart_id INTO v_cart_id;
    END IF;
    
    RETURN v_cart_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- MIGRATION COMPLETE - SAFE FOR EXISTING DATA
-- =============================================

-- Run this to verify trigger is working:
-- SELECT EXISTS (
--   SELECT 1 FROM pg_trigger 
--   WHERE tgname = 'on_auth_user_created' 
--   AND tgrelid = 'auth.users'::regclass
-- ) AS trigger_exists;
