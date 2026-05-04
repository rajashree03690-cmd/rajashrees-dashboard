import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { getSupabaseClient, getAdminClient } from "../_shared/db.ts"
import { validateUser, getCustomer } from "../_shared/auth.ts"

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const user = await validateUser(req)
        const requestBody = await req.json()
        console.log("🛒 cart-update Request Body:", requestBody)
        const { cart_item_id, quantity } = requestBody

        if (!cart_item_id || quantity === undefined) {
            return new Response(JSON.stringify({ error: 'cart_item_id and quantity required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = getSupabaseClient(req)
        const adminClient = getAdminClient()
        const customer = await getCustomer(supabase, user.id)
        console.log("👤 Customer resolved:", customer.customer_id)

        // 1. Verify item belongs to customer
        const { data: item, error: checkError } = await adminClient
            .from('cart_item')
            .select(`
        cart_item_id,
        cart!inner(customer_id)
      `)
            .eq('cart_item_id', cart_item_id)
            .maybeSingle()

        console.log("🔍 Check item result:", { item, checkError })

        if (checkError || !item || item.cart.customer_id !== customer.customer_id) {
            return new Response(JSON.stringify({ error: 'Item not found or unauthorized' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Update quantity
        const { data, error } = await adminClient
            .from('cart_item')
            .update({ quantity })
            .eq('cart_item_id', cart_item_id)
            .select()

        if (error) throw error

        return new Response(JSON.stringify({
            success: true,
            message: 'Quantity updated',
            data: data
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error("❌ cart-update ERROR:", error)
        return new Response(JSON.stringify({ 
            success: false,
            error: error.message,
            stack: error.stack,
            message: `Update failed: ${error.message}`
        }), {
            status: error.message === 'Unauthorized' ? 401 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
