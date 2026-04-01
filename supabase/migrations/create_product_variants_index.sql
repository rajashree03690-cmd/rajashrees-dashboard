-- =============================================
-- PERFORMANCE FIX: Add index to product_variants.product_id
-- Prevents full table scans when fetching variants for products
-- =============================================

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id 
ON product_variants(product_id);
