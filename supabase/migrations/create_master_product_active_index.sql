-- Optimized Partial Index for Products-List Edge Function Query
-- This index specifically targets active products, allowing Postgres to instantly locate the top 20 active products without scanning through millions of dead tuples or unindexed subqueries.
-- This is completely non-destructive, requires NO downtime, and will not interrupt WooCommerce syncs.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_master_product_active_products_desc 
ON public.master_product (product_id DESC) 
WHERE is_active = true;
