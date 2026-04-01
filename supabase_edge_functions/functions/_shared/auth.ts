import { getSupabaseClient } from './db.ts'

export async function validateUser(req: Request) {
    const authHeader = req.headers.get('authorization')

    if (!authHeader) {
        return null
    }

    const supabase = getSupabaseClient(req)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
        throw new Error('Unauthorized')
    }

    return user
}

export async function getCustomer(supabase: any, authId: string) {
    const { data: customer, error } = await supabase
        .from('customers')
        .select('customer_id, email, full_name, mobile_number')
        .eq('auth_id', authId)
        .single()

    if (error) {
        throw new Error('Customer not found')
    }

    return customer
}
