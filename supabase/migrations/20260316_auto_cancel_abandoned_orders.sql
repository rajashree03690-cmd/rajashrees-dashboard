-- Create the cleanup function
CREATE OR REPLACE FUNCTION auto_cancel_expired_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Cancel orders that are 'awaiting_payment' or 'pending_payment' and older than 15 minutes
  -- SAFETY: Never overwrite orders that have already been paid/refunded (race condition protection)
  UPDATE public.orders
  SET 
    order_status = 'failed',
    payment_status = 'failed',
    order_note = COALESCE(order_note || CHR(10), '') || 'Auto-cancelled: Payment timeout after 15 minutes',
    updated_at = NOW()
  WHERE 
    (order_status = 'awaiting_payment' OR order_status = 'pending_payment')
    AND payment_status NOT IN ('paid', 'refunded', 'partially_refunded')
    AND created_at < NOW() - INTERVAL '15 minutes';
END;
$$;

-- Safely schedule the cron job
DO $$
BEGIN
  -- First check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
  
    -- Try to unschedule if it exists (ignore error if it doesn't)
    BEGIN
      PERFORM cron.unschedule('auto-cancel-abandoned-orders');
    EXCEPTION WHEN OTHERS THEN
      -- Job doesn't exist yet, which is fine
    END;
    
    -- Schedule it to run every 5 minutes
    PERFORM cron.schedule(
      'auto-cancel-abandoned-orders',
      '*/5 * * * *',
      'SELECT auto_cancel_expired_orders();'
    );
    
  END IF;
END $$;
