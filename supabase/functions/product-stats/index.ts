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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('📊 Fetching product statistics natively...')

    // 1. Get raw counts natively (super fast head queries)
    const [productsRes, variantsRes, lowStockRes] = await Promise.all([
      supabase.from('master_product').select('product_id', { count: 'exact', head: true }).eq('is_Active', true),
      supabase.from('product_variants').select('variant_id', { count: 'exact', head: true }),
      supabase.from('product_variants').select('variant_id', { count: 'exact', head: true }).lt('stock', 10)
    ])

    // 2. Fetch only necessary exact fields to compute inventory securely without blowing up memory
    let totalInventory = 0;
    
    // We fetch in chunks of 5000 to prevent Deno memory crashes if variants grow to >20,000
    let hasMore = true;
    let offset = 0;
    while(hasMore) {
        const { data: variants, error } = await supabase
            .from('product_variants')
            .select('stock, saleprice, regularprice')
            .range(offset, offset + 4999);
            
        if (error) throw error;
        
        if (!variants || variants.length === 0) {
            hasMore = false;
            break;
        }

        for (const v of variants) {
            const price = v.saleprice || v.regularprice || 0;
            totalInventory += (v.stock || 0) * price;
        }
        
        if (variants.length < 5000) {
            hasMore = false;
        } else {
            offset += 5000;
        }
    }

    return new Response(JSON.stringify({
      totalProducts: productsRes.count || 0,
      variantsLoaded: variantsRes.count || 0,
      lowStockItems: lowStockRes.count || 0,
      inventoryValue: totalInventory,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('❌ Stats Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Stats fetch failed', raw: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
