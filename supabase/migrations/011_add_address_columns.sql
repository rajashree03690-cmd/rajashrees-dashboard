-- Add missing city column to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Verify the change
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customers' 
  AND column_name IN ('full_name', 'address', 'city', 'state', 'pincode', 'auth_id')
ORDER BY column_name;
