-- Drop policy if it exists, then create it
-- This ensures clean creation without IF NOT EXISTS issues

DROP POLICY IF EXISTS "Allow public email check for auth flow" ON public.customers;

CREATE POLICY "Allow public email check for auth flow"
ON public.customers
FOR SELECT
TO anon
USING (true);

-- Verify policy was created
SELECT policyname, tablename, cmd, roles 
FROM pg_policies 
WHERE tablename = 'customers' 
AND policyname = 'Allow public email check for auth flow';
