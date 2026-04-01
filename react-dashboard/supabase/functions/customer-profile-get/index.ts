import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Customer Profile GET - Advanced Edition
 * Retrieves comprehensive customer profile with analytics
 */
serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client with service role
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Authenticate user from JWT token
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Authentication required',
                    code: 'AUTH_REQUIRED'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401
                }
            )
        }

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !user) {
            console.error('Auth error:', authError?.message)
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Invalid or expired authentication token',
                    code: 'AUTH_INVALID'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 401
                }
            )
        }

        const userId = user.id

        // Fetch customer profile with related data
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select(`
                customer_id,
                email,
                full_name,
                mobile_number,
                address,
                door_no,
                street,
                landmark,
                district,
                city,
                state,
                pincode,
                alternative_mobile,
                created_at,
                updated_at
            `)
            .eq('auth_id', userId)
            .single()

        if (customerError) {
            // If customer not found, create a basic profile
            if (customerError.code === 'PGRST116') {
                const { data: newCustomer, error: createError } = await supabaseClient
                    .from('customers')
                    .insert({
                        auth_id: userId,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Customer',
                        mobile_number: user.user_metadata?.mobile_number || 'TEMP_' + Date.now(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single()

                if (createError) {
                    console.error('Error creating customer:', createError)
                    return new Response(
                        JSON.stringify({
                            success: false,
                            message: 'Failed to create customer profile',
                            code: 'PROFILE_CREATE_FAILED',
                            details: createError.message
                        }),
                        {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                            status: 500
                        }
                    )
                }

                // Return newly created profile
                return new Response(
                    JSON.stringify({
                        success: true,
                        data: {
                            profile: {
                                customer_id: newCustomer.customer_id,
                                email: newCustomer.email,
                                full_name: newCustomer.full_name,
                                mobile_number: newCustomer.mobile_number,
                                address: {
                                    line1: newCustomer.address,
                                    line2: null,
                                    city: newCustomer.city,
                                    state: newCustomer.state,
                                    postal_code: newCustomer.pincode
                                },
                                created_at: newCustomer.created_at,
                                updated_at: newCustomer.updated_at
                            },
                            analytics: {
                                profile_completion: calculateProfileCompletion(newCustomer),
                                is_new_profile: true,
                                account_age_days: 0
                            }
                        },
                        message: 'New profile created successfully'
                    }),
                    {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        status: 200
                    }
                )
            }

            // Other database errors
            console.error('Error fetching customer:', customerError)
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Failed to fetch customer profile',
                    code: 'PROFILE_FETCH_FAILED',
                    details: customerError.message
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500
                }
            )
        }

        // Get order statistics for analytics
        const { count: orderCount } = await supabaseClient
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.customer_id)

        // Calculate profile analytics
        const profileCompletion = calculateProfileCompletion(customer)
        const accountAgeDays = Math.floor(
            (new Date().getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24)
        )

        // Return comprehensive profile data
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    profile: {
                        customer_id: customer.customer_id,
                        email: customer.email,
                        full_name: customer.full_name,
                        mobile_number: customer.mobile_number,
                        address: {
                            line1: customer.address,
                            line2: null,
                            door_no: customer.door_no,
                            street: customer.street,
                            landmark: customer.landmark,
                            district: customer.district,
                            city: customer.city,
                            state: customer.state,
                            postal_code: customer.pincode
                        },
                        alternative_mobile: customer.alternative_mobile,
                        created_at: customer.created_at,
                        updated_at: customer.updated_at
                    },
                    analytics: {
                        profile_completion: profileCompletion,
                        total_orders: orderCount || 0,
                        account_age_days: accountAgeDays,
                        is_new_profile: false
                    }
                },
                message: 'Profile fetched successfully'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                message: 'Internal server error',
                code: 'INTERNAL_ERROR',
                details: error.message
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})

/**
 * Calculate profile completion percentage
 */
function calculateProfileCompletion(customer: any): number {
    const fields = [
        customer.full_name,
        customer.mobile_number,
        customer.address,
        customer.city,
        customer.state,
        customer.pincode
    ]

    const filledFields = fields.filter(field => {
        if (!field) return false;
        if (typeof field !== 'string') return true; // non-string but truthy = filled
        return field.trim() !== '';
    }).length
    return Math.round((filledFields / fields.length) * 100)
}
