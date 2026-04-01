-- Ensure 'invoices' bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Grant public access (or authenticated) to 'invoices'
-- Since we are generating public URLs, public access is required for viewing
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'invoices' );

-- Allow Service Role full access (implicit, but good to ensure no blocks)
-- Note: Service Role bypasses RLS, so specific policies aren't strict requirements for it,
-- but having a public select policy is needed for the frontend to view the PDF.
