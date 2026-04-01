-- =====================================================
-- ADD SOURCE COLUMN & UNIQUE CONSTRAINTS
-- =====================================================

-- Step 1: Add source column
ALTER TABLE public.customers 
ADD COLUMN source VARCHAR(20) DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'web'));

-- Step 2: Update existing customers
-- Customers with auth_id are Web customers
UPDATE public.customers 
SET source = 'web' 
WHERE auth_id IS NOT NULL;

-- Customers with NULL auth_id are WhatsApp customers
UPDATE public.customers 
SET source = 'whatsapp' 
WHERE auth_id IS NULL;

-- Step 3: Make source NOT NULL after populating
ALTER TABLE public.customers 
ALTER COLUMN source SET NOT NULL;

-- Step 4: Add partial UNIQUE constraints
-- For WhatsApp: One phone number = one customer
CREATE UNIQUE INDEX customers_whatsapp_phone_unique 
ON public.customers (mobile_number) 
WHERE source = 'whatsapp' AND mobile_number IS NOT NULL;

-- For Web: One email = one customer
CREATE UNIQUE INDEX customers_web_email_unique 
ON public.customers (email) 
WHERE source = 'web' AND email IS NOT NULL;

-- Step 5: Verify the changes
SELECT 
    source,
    COUNT(*) as total_customers,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(DISTINCT mobile_number) as unique_phones
FROM public.customers
GROUP BY source;
