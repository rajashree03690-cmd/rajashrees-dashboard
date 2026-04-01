-- Production Schema Setup
-- This matches the actual production database structure

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    customer_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR,
    mobile_number VARCHAR,
    email VARCHAR,
    address TEXT,
    city VARCHAR,
    state TEXT,
    pincode TEXT,
    auth_id UUID REFERENCES auth.users(id),
    source VARCHAR NOT NULL DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'web')),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Addresses Table
CREATE TABLE IF NOT EXISTS public.addresses (
    address_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES public.customers(customer_id),
    full_name VARCHAR NOT NULL,
    mobile_number VARCHAR NOT NULL,
    pincode VARCHAR NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    landmark TEXT,
    city VARCHAR NOT NULL,
    state VARCHAR NOT NULL,
    country VARCHAR DEFAULT 'India',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PRODUCT CATALOG
-- =====================================================

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Subcategories
CREATE TABLE IF NOT EXISTS public.subcategories (
    subcategory_id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES public.categories(id),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Master Product
CREATE TABLE IF NOT EXISTS public.master_product (
    product_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    subcategory_id BIGINT REFERENCES public.subcategories(subcategory_id),
    description TEXT,
    image_url TEXT,
    sku VARCHAR,
    has_variant BOOLEAN DEFAULT FALSE,
    is_Active BOOLEAN NOT NULL DEFAULT TRUE,
    rating REAL,
    review_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
    variant_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY UNIQUE,
    product_id BIGINT REFERENCES public.master_product(product_id),
    variant_name TEXT,
    sku TEXT UNIQUE,
    color TEXT,
    size TEXT,
    regularprice NUMERIC,
    saleprice NUMERIC,
    costprice REAL,
    stock INTEGER DEFAULT 0,
    weight NUMERIC,
    length TEXT,
    image_url TEXT,
    is_variant BOOLEAN DEFAULT FALSE,
    is_Active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Combo
CREATE TABLE IF NOT EXISTS public.combo (
    combo_id NUMERIC PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    image_url VARCHAR,
    sku VARCHAR,
    combo_quantity NUMERIC NOT NULL,
    regularprice NUMERIC,
    saleprice NUMERIC,
    subcategory_id INTEGER REFERENCES public.subcategories(subcategory_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE
);

-- Combo Items
CREATE TABLE IF NOT EXISTS public.combo_items (
    combo_item_id NUMERIC PRIMARY KEY,
    combo_id NUMERIC REFERENCES public.combo(combo_id),
    variant_id BIGINT REFERENCES public.product_variants(variant_id),
    quantity_per_combo INTEGER NOT NULL
);

-- =====================================================
-- CART & WISHLIST
-- =====================================================

-- Cart (CORRECTED TO MATCH PRODUCTION)
CREATE TABLE IF NOT EXISTS public.cart (
    cart_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id BIGINT REFERENCES public.customers(customer_id),
    status TEXT DEFAULT 'active',
    cartAmount DOUBLE PRECISION,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Cart Items (CORRECTED TO MATCH PRODUCTION)
CREATE TABLE IF NOT EXISTS public.cart_item (
    cart_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES public.cart(cart_id),
    variant_id BIGINT REFERENCES public.product_variants(variant_id),
    quantity INTEGER DEFAULT 1,
    price_at_add NUMERIC NOT NULL,
    added_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Wishlist
CREATE TABLE IF NOT EXISTS public.wishlist (
    wishlist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id BIGINT REFERENCES public.customers(customer_id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Wishlist Items
CREATE TABLE IF NOT EXISTS public.wishlist_item (
    wishlist_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wishlist_id UUID REFERENCES public.wishlist(wishlist_id),
    variant_id BIGINT REFERENCES public.product_variants(variant_id),
    added_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ORDERS
-- =====================================================

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
    order_id VARCHAR PRIMARY KEY,
    customer_id INTEGER REFERENCES public.customers(customer_id),
    name TEXT,
    contact_number TEXT,
    shipping_address TEXT,
    shipping_state TEXT,
    shipping_pincode TEXT,
    order_status VARCHAR,
    total_amount NUMERIC,
    shipping_amount NUMERIC,
    payment_method VARCHAR,
    payment_transaction_id TEXT,
    order_note TEXT,
    source VARCHAR,
    invoice_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    id BIGINT GENERATED ALWAYS AS IDENTITY
);

-- Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
    order_item_id VARCHAR PRIMARY KEY,
    order_id VARCHAR REFERENCES public.orders(order_id),
    catalogue_product_id BIGINT REFERENCES public.product_variants(variant_id),
    quantity INTEGER,
    is_combo BOOLEAN NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    id BIGINT GENERATED ALWAYS AS IDENTITY
);

-- =====================================================
-- REVIEWS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id BIGINT,
    customer_id BIGINT REFERENCES public.customers(customer_id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    status BOOLEAN,
    sentiment TEXT,
    sentiment_score DOUBLE PRECISION,
    summary TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SUPPORT & QUERIES
-- =====================================================

-- Queries
CREATE TABLE IF NOT EXISTS public.queries (
    query_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT REFERENCES public.customers(customer_id),
    name VARCHAR,
    mobile_number VARCHAR NOT NULL,
    email VARCHAR,
    message TEXT NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'Open',
    priority TEXT,
    order_id TEXT,
    remarks TEXT,
    source VARCHAR CHECK (source IN ('Email', 'WhatsApp', 'Phone')),
    is_escalated BOOLEAN DEFAULT FALSE,
    escalated_ticket_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Query Messages
CREATE TABLE IF NOT EXISTS public.query_messages (
    message_id SERIAL PRIMARY KEY,
    query_id BIGINT REFERENCES public.queries(query_id),
    sender_type VARCHAR NOT NULL,
    message TEXT NOT NULL,
    delivered BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customers_auth_id ON public.customers(auth_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_cart_customer ON public.cart(customer_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_item(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON public.cart_item(variant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_item ENABLE ROW LEVEL SECURITY;

-- Customers: Users can view and modify their own data
DROP POLICY IF EXISTS "Users can view own customer data" ON public.customers;
CREATE POLICY "Users can view own customer data"
    ON public.customers FOR SELECT
    USING (auth.uid() = auth_id);

DROP POLICY IF EXISTS "Users can update own customer data" ON public.customers;
CREATE POLICY "Users can update own customer data"
    ON public.customers FOR UPDATE
    USING (auth.uid() = auth_id);

-- Cart: Users can manage their own cart
DROP POLICY IF EXISTS "Users can view own cart" ON public.cart;
CREATE POLICY "Users can view own cart"
    ON public.cart FOR SELECT
    USING (customer_id IN (SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can modify own cart" ON public.cart;
CREATE POLICY "Users can modify own cart"
    ON public.cart FOR ALL
    USING (customer_id IN (SELECT customer_id FROM public.customers WHERE auth_id = auth.uid()));

-- Cart Items: Users can manage their cart items
DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_item;
CREATE POLICY "Users can view own cart items"
    ON public.cart_item FOR SELECT
    USING (cart_id IN (
        SELECT cart_id FROM public.cart 
        WHERE customer_id IN (SELECT customer_id FROM public.customers WHERE auth_id = auth.uid())
    ));

DROP POLICY IF EXISTS "Users can modify own cart items" ON public.cart_item;
CREATE POLICY "Users can modify own cart items"
    ON public.cart_item FOR ALL
    USING (cart_id IN (
        SELECT cart_id FROM public.cart 
        WHERE customer_id IN (SELECT customer_id FROM public.customers WHERE auth_id = auth.uid())
    ));
