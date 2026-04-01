-- Add UNIQUE constraint on customers.email for UPSERT to work

-- Step 1: Add UNIQUE constraint to email column
ALTER TABLE public.customers 
ADD CONSTRAINT customers_email_unique UNIQUE (email);

-- This enables the frontend upsert with onConflict: 'email' to work correctly
