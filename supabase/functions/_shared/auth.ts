import { getSupabaseClient, getAdminClient } from './db.ts'

export async function validateUser(req: Request) {
    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
        return null
    }

    const supabase = getSupabaseClient(req)
    const token = authHeader.replace('Bearer ', '')
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            console.error('❌ validateUser failed:', error?.message || 'No user found')
            throw new Error('Unauthorized')
        }

        console.log('✅ User validated:', user.id)
        return user
    } catch (err: any) {
        console.error('❌ validateUser generic crash (likely malformed SUPABASE_URL):', err?.message || String(err))
        throw new Error('Unauthorized')
    }
}

export async function getCustomer(supabase: any, authId: string) {
    const adminClient = getAdminClient()
    const { data: customer, error } = await adminClient
        .from('customers')
        .select('customer_id, email, full_name, mobile_number')
        .eq('auth_id', authId)
        .single()

    if (error) {
        console.error('❌ getCustomer failed for auth_id:', authId, 'Error:', error?.message)
        throw new Error('Customer not found')
    }

    console.log('✅ Customer resolved:', customer.customer_id)
    return customer
}
