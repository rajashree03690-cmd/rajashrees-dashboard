import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log('📊 Fetching product statistics...')

        // 1. Total Active Products
        const { count: totalProducts, error: productsError } = await supabaseClient
            .from('master_product')
            .select('*', { count: 'exact', head: true })
            .eq('is_Active', true)

        if (productsError) {
            console.error('Error counting products:', productsError)
        }

        // 2. Total Variants
        const { count: totalVariants, error: variantsError } = await supabaseClient
            .from('product_variants')
            .select('*', { count: 'exact', head: true })

        if (variantsError) {
            console.error('Error counting variants:', variantsError)
        }

        // 3. Low Stock Items (stock < 10)
        const { count: lowStockItems, error: lowStockError } = await supabaseClient
            .from('product_variants')
            .select('*', { count: 'exact', head: true })
            .lt('stock', 10)

        if (lowStockError) {
            console.error('Error counting low stock:', lowStockError)
        }

        // 4. Inventory Value (sum of stock * saleprice)
        const { data: variantsData, error: valuesError } = await supabaseClient
            .from('product_variants')
            .select('stock, saleprice, regularprice')

        let inventoryValue = 0
        if (!valuesError && variantsData) {
            inventoryValue = variantsData.reduce((sum, variant) => {
                const stock = variant.stock || 0
                const price = variant.saleprice || variant.regularprice || 0
                return sum + (stock * price)
            }, 0)
        }

        return new Response(
            JSON.stringify({
                totalProducts: totalProducts || 0,
                variantsLoaded: totalVariants || 0,
                lowStockItems: lowStockItems || 0,
                inventoryValue: Math.round(inventoryValue),
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error: any) {
        console.error('❌ Error generating product stats:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
