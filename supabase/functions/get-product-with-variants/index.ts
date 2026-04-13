import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const product_id = url.searchParams.get('product_id');

        if (!product_id) {
            return new Response(JSON.stringify({
                success: false,
                message: 'product_id is required'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch product with variants
        const { data: product, error: productError } = await supabase
            .from('master_product')
            .select(`
                *,
                variants:product_variants(
                    variant_id,
                    variant_name,
                    saleprice,
                    regularprice,
                    stock,
                    sku,
                    image_url,
                    image_2_url,
                    image_3_url
                )
            `)
            .eq('product_id', product_id)
            .single();

        if (productError) {
            console.error('Product fetch error:', productError);
            throw new Error(productError.message);
        }

        if (!product) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Product not found'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Ensure variants array exists - create default if none exist
        if (!product.variants || product.variants.length === 0) {
            console.log(`No variants found for product ${product_id}, creating default`);
            product.variants = [{
                variant_id: product.product_id,
                variant_name: 'Standard',
                saleprice: product.saleprice || 0,
                regularprice: product.regularprice || product.saleprice || 0,
                stock: product.stock || 0,
                sku: product.sku,
                image_url: product.image_url
            }];
        }

        // Return product with variants
        return new Response(JSON.stringify(product), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in get-product-with-variants:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
