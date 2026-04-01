import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const productsApiService = {
    /**
     * Add new product with variants via Edge Function (bypasses RLS with service role)
     */
    async addProduct(productData: any): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📤 Adding product via Edge Function...');

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/create-product-with-variants`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(productData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Add product failed:', errorData);
                return { success: false, error: errorData.error || response.statusText };
            }

            const result = await response.json();
            console.log('✅ Product added successfully:', result);
            return { success: true };
        } catch (error) {
            console.error('❌ Add Product Error:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Update existing product with variants via Edge Function
     */
    async updateProduct(productId: number, productData: any): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📤 Updating product via Edge Function...');

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/update-product-with-variants`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        product_id: productId,
                        ...productData,
                    }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Update product failed:', errorData);
                return { success: false, error: errorData.error || response.statusText };
            }

            const result = await response.json();
            console.log('✅ Product updated successfully:', result);
            return { success: true };
        } catch (error) {
            console.error('❌ Update Product Error:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Upload image to Supabase Storage
     */
    async uploadImage(file: File, prefix: string = 'product'): Promise<{ url?: string; error?: string }> {
        try {
            const fileName = `${prefix}_${Date.now()}.${file.name.split('.').pop()}`;

            const { data, error } = await supabase.storage
                .from('product-images')
                .upload(fileName, file, {
                    upsert: true,
                });

            if (error) {
                console.error('❌ Image upload failed:', error);
                return { error: error.message };
            }

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);

            console.log('✅ Image uploaded:', publicUrl);
            return { url: publicUrl };
        } catch (error) {
            console.error('❌ Image Upload Error:', error);
            return { error: String(error) };
        }
    },

    /**
     * Create product with variants via Edge Function
     */
    async createProductWithVariants(productData: any): Promise<{ success: boolean; error?: string; data?: any }> {
        try {
            console.log('📤 Creating product with variants...');

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/create-product-with-variants`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(productData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Create product failed:', errorData);
                return { success: false, error: errorData.error || response.statusText };
            }

            const result = await response.json();
            console.log('✅ Product created successfully:', result);
            return { success: true, data: result };
        } catch (error) {
            console.error('❌ Create Product Error:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Validate product SKU and name for duplicates
     */
    async validateProduct(sku: string, name: string, excludeProductId?: number): Promise<{ valid: boolean; field?: string; message?: string }> {
        try {
            const response = await fetch('/api/validate-product', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sku, name, excludeProductId }),
            });

            if (!response.ok) {
                throw new Error('Validation request failed');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('❌ Validation Error:', error);
            return { valid: true }; // Allow save if validation fails
        }
    },
};
