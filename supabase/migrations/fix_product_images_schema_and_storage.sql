-- 1. Create product-images Bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

-- 3. Create RLS Policies for product-images
-- Allow public reading of images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Allow authenticated users (staff/admin) to upload
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'product-images' );

-- Allow authenticated users to update
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'product-images' );

-- Allow authenticated users to delete
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'product-images' );

-- 4. Add Multi-Image Columns to master_product
ALTER TABLE public.master_product
ADD COLUMN IF NOT EXISTS image_2_url text,
ADD COLUMN IF NOT EXISTS image_3_url text;

-- 5. Add Multi-Image Columns to product_variants (optional, for consistency)
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS image_2_url text,
ADD COLUMN IF NOT EXISTS image_3_url text;
