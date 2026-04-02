-- =====================================================
-- CLEANUP DUPLICATE CUSTOMERS
-- =====================================================

-- CRITICAL: Run this in a transaction so you can rollback if needed
BEGIN;

-- 1. Clean up arun@foxindia.org (same auth_id, keep only one)
-- Keep the FIRST customer (3267), delete the rest
DELETE FROM public.customers 
WHERE email = 'arun@foxindia.org' 
  AND customer_id IN (3271, 3272, 3268, 3269, 3270, 3273);

-- Verify: Should have 1 customer left for arun@foxindia.org
SELECT * FROM public.customers WHERE email = 'arun@foxindia.org';

-- 2. Clean up WhatsApp customer duplicates (NULL auth_id)
-- For each email, keep the one with the LOWEST customer_id (oldest)

-- ashasundhar78@gmail.com
DELETE FROM public.customers 
WHERE email = 'ashasundhar78@gmail.com' AND customer_id = 2824;

-- gthor3559@gmail.com
DELETE FROM public.customers 
WHERE email = 'gthor3559@gmail.com' AND customer_id = 3011;

-- jay28laksh@gmail.com
DELETE FROM public.customers 
WHERE email = 'jay28laksh@gmail.com' AND customer_id = 2153;

-- jayanthi101010@gmail.com
DELETE FROM public.customers 
WHERE email = 'jayanthi101010@gmail.com' AND customer_id = 862;

-- jerlinnishiya@gmail.com
DELETE FROM public.customers 
WHERE email = 'jerlinnishiya@gmail.com' AND customer_id = 3164;

-- pmanila82@gmail.com
DELETE FROM public.customers 
WHERE email = 'pmanila82@gmail.com' AND customer_id = 2088;

-- reemthasara2k1@gmail.com
DELETE FROM public.customers 
WHERE email = 'reemthasara2k1@gmail.com' AND customer_id = 2217;

-- rkkowsaki@gmail.com
DELETE FROM public.customers 
WHERE email = 'rkkowsaki@gmail.com' AND customer_id = 2645;

-- rv830799@gmail.com
DELETE FROM public.customers 
WHERE email = 'rv830799@gmail.com' AND customer_id = 2654;

-- Sivanagaraj2362@gmail.com
DELETE FROM public.customers 
WHERE email = 'Sivanagaraj2362@gmail.com' AND customer_id = 2341;

-- sujanapandian@gmail.com
DELETE FROM public.customers 
WHERE email = 'sujanapandian@gmail.com' AND customer_id = 1286;

-- sumathikrithiga@gmail.com
DELETE FROM public.customers 
WHERE email = 'sumathikrithiga@gmail.com' AND customer_id = 3029;

-- vickysarandale@gmail.com
DELETE FROM public.customers 
WHERE email = 'vickysarandale@gmail.com' AND customer_id = 1202;

-- vijivjp11@gmail.com
DELETE FROM public.customers 
WHERE email = 'vijivjp11@gmail.com' AND customer_id = 1416;

-- 3. Verify no more duplicates
SELECT email, COUNT(*) as count
FROM public.customers
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Should return 0 rows

-- 4. If everything looks good, COMMIT
COMMIT;

-- If something is wrong, run: ROLLBACK;
