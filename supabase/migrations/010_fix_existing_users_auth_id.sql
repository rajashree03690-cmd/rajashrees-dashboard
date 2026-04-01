-- =====================================================
-- FIX EXISTING USERS - LINK AUTH_ID TO CUSTOMERS
-- =====================================================

-- This migration fixes existing users who were created before 
-- the new auth system was implemented. It links their auth.users 
-- record to their customers record via auth_id.

-- Step 1: Show current state (for diagnostics)
DO $$
BEGIN
    RAISE NOTICE 'Customers without auth_id: %', 
        (SELECT COUNT(*) FROM public.customers WHERE auth_id IS NULL);
    RAISE NOTICE 'Auth users: %', 
        (SELECT COUNT(*) FROM auth.users);
END $$;

-- Step 2: Update existing customers with matching auth users
UPDATE public.customers c
SET auth_id = u.id,
    updated_at = NOW()
FROM auth.users u
WHERE c.email = u.email
  AND c.auth_id IS NULL
  AND c.source = 'web';  -- Only update web customers

-- Step 3: Show results
DO $$
BEGIN
    RAISE NOTICE 'Customers NOW with auth_id: %', 
        (SELECT COUNT(*) FROM public.customers WHERE auth_id IS NOT NULL);
    RAISE NOTICE 'Customers STILL without auth_id: %', 
        (SELECT COUNT(*) FROM public.customers WHERE auth_id IS NULL);
END $$;

-- Step 4: Create customers for auth users who don't have customer records
INSERT INTO public.customers (
    auth_id,
    email,
    full_name,
    mobile_number,
    source,
    created_at,
    updated_at
)
SELECT 
    u.id,
    u.email,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        SPLIT_PART(u.email, '@', 1)
    ) as full_name,
    u.raw_user_meta_data->>'mobile_number' as mobile_number,
    'web' as source,
    u.created_at,
    NOW()
FROM auth.users u
LEFT JOIN public.customers c ON c.auth_id = u.id
WHERE c.customer_id IS NULL  -- No customer record exists
  AND u.email NOT LIKE '%@example.com';  -- Exclude test users

-- Step 5: Final verification
SELECT 
    'Auth Users' as category,
    COUNT(*) as count
FROM auth.users
UNION ALL
SELECT 
    'Customers with auth_id',
    COUNT(*)
FROM public.customers
WHERE auth_id IS NOT NULL
UNION ALL
SELECT 
    'Customers without auth_id',
    COUNT(*)
FROM public.customers
WHERE auth_id IS NULL;
