-- ========================================================================
-- Auto-cancel expired orders (Cron runs every 5 minutes)
-- 
-- SAFETY GUARDS:
--   1. Timeout: 45 minutes (not 15) — UPI payments in India routinely
--      take 15-25 minutes due to bank delays, OTP retries, app switching
--   2. razorpay_payment_id IS NULL — NEVER cancel an order that already
--      has a captured payment ID from Razorpay
--   3. payment_status NOT IN ('paid', 'refunded', 'partially_refunded')
--      — NEVER overwrite a paid/refunded order
-- ========================================================================

CREATE OR REPLACE FUNCTION auto_cancel_expired_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.orders
  SET 
    order_status = 'failed',
    payment_status = 'failed',
    order_note = COALESCE(order_note || CHR(10), '') || 'Auto-cancelled: Payment timeout after 45 minutes',
    updated_at = NOW()
  WHERE 
    (order_status = 'awaiting_payment' OR order_status = 'pending_payment')
    AND payment_status NOT IN ('paid', 'refunded', 'partially_refunded')
    AND razorpay_payment_id IS NULL
    AND created_at < NOW() - INTERVAL '45 minutes';
END;
$$;

-- Schedule: every 5 minutes
-- SELECT cron.schedule('auto-cancel-expired-orders', '*/5 * * * *', 'SELECT auto_cancel_expired_orders();');

-- ========================================================================
-- Reconciliation Cron Job (runs every 10 minutes)
-- Calls the reconcile-payments edge function to check Razorpay API
-- for any captured payments on failed orders
-- ========================================================================
-- SELECT cron.schedule(
--   'reconcile-payments-job',
--   '*/10 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://gvsorguincvinuiqtooo.supabase.co/functions/v1/reconcile-payments',
--     headers := '{"Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
