-- ============================================================
-- MIGRATION 019: PRODUCTION AUDIT TABLES (CORRECTED)
-- Based on actual production schema dump
-- Safe to run: uses IF NOT EXISTS and DO blocks
-- ============================================================

-- =====================================================
-- 1. ADD MISSING COLUMNS TO ORDERS TABLE
-- orders already has: payment_status, refund_status, refunded_amount,
-- updated_at, invoice_number, invoice_generated_at, is_locked, auth_id
-- MISSING: cancelled_by, cancellation_reason
-- =====================================================

DO $$
BEGIN
    -- cancelled_by: 'admin' or 'customer'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cancelled_by') THEN
        ALTER TABLE public.orders ADD COLUMN cancelled_by VARCHAR;
    END IF;

    -- cancellation_reason: free text explaining why
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'cancellation_reason') THEN
        ALTER TABLE public.orders ADD COLUMN cancellation_reason TEXT;
    END IF;
END $$;

-- =====================================================
-- 2. UPDATE payment_status CHECK CONSTRAINT
-- Current: pending, awaiting_payment, paid, failed, refunded
-- Need to add: partially_refunded
-- =====================================================

DO $$
BEGIN
    -- Drop old constraint and recreate with partially_refunded
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
        CHECK (payment_status = ANY (ARRAY[
            'pending'::text,
            'awaiting_payment'::text,
            'paid'::text,
            'failed'::text,
            'refunded'::text,
            'partially_refunded'::text
        ]));
END $$;

-- =====================================================
-- 3. ORDER EVENTS TABLE (TIMELINE / AUDIT LOG)
-- Does NOT exist in production yet.
-- Powers the order history timeline in the admin dashboard.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
    event_type VARCHAR NOT NULL,
    description TEXT,
    metadata JSONB,
    created_by VARCHAR DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_events_order ON public.order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_type ON public.order_events(event_type);
CREATE INDEX IF NOT EXISTS idx_order_events_created ON public.order_events(created_at);

-- RLS
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on order_events" ON public.order_events;
CREATE POLICY "Allow all operations on order_events" ON public.order_events
    FOR ALL USING (true) WITH CHECK (true);

-- Realtime
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_events;
EXCEPTION WHEN OTHERS THEN
    NULL; -- ignore if already added
END $$;

COMMENT ON TABLE public.order_events IS 'Timeline audit log for every order event. Powers order history in admin dashboard.';

-- =====================================================
-- 4. PERFORMANCE INDEXES ON ORDERS (if missing)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check order_events exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'order_events';

-- Check new columns on orders
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('cancelled_by', 'cancellation_reason');

-- Verify CHECK constraint includes partially_refunded
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
AND conname LIKE '%payment_status%';
