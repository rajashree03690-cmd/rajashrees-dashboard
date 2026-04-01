import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Customer Profile UPDATE - Advanced Edition  
 * Updates customer profile with validation and audit logging
 */
serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Authenticate user
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

        // Parse request body
        const body = await req.json()

        // Validate and sanitize input
        const validationResult = validateProfileUpdate(body)
        if (!validationResult.valid) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    errors: validationResult.errors
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                }
            )
        }

        // Check if customer exists
        const { data: existingCustomer, error: fetchError } = await supabaseClient
            .from('customers')
            .select('customer_id, email')
            .eq('auth_id', userId)
            .single()

        if (fetchError || !existingCustomer) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Customer profile not found',
                    code: 'PROFILE_NOT_FOUND'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404
                }
            )
        }

        // Prepare update data
        const updateData: any = {
            updated_at: new Date().toISOString()
        }

        // Map and sanitize fields
        if (body.full_name !== undefined) {
            updateData.full_name = body.full_name.trim()
        }
        if (body.mobile_number !== undefined) {
            updateData.mobile_number = body.mobile_number.trim()
        }
        if (body.alternative_mobile !== undefined) {
            updateData.alternative_mobile = body.alternative_mobile ? body.alternative_mobile.trim() : null
        }

        // Map address fields
        if (body.address_line1 !== undefined || body.address !== undefined) {
            updateData.address = (body.address_line1 || body.address || '').trim()
        }
        if (body.door_no !== undefined) updateData.door_no = body.door_no.trim()
        if (body.street !== undefined) updateData.street = body.street.trim()
        if (body.landmark !== undefined) updateData.landmark = body.landmark.trim()
        if (body.district !== undefined) updateData.district = body.district.trim()

        if (body.city !== undefined) {
            updateData.city = body.city.trim()
        }
        if (body.state !== undefined) {
            updateData.state = body.state.trim()
        }
        // Map postal_code to pincode column
        if (body.postal_code !== undefined || body.pincode !== undefined) {
            updateData.pincode = (body.postal_code || body.pincode || '').trim()
        }

        // Update customer profile
        const { data: updatedCustomer, error: updateError } = await supabaseClient
            .from('customers')
            .update(updateData)
            .eq('customer_id', existingCustomer.customer_id)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating customer:', updateError)
            return new Response(
                JSON.stringify({
                    success: false,
                    message: 'Failed to update profile',
                    code: 'UPDATE_FAILED',
                    details: updateError.message
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 500
                }
            )
        }

        // Calculate updated profile completion
        const profileCompletion = calculateProfileCompletion(updatedCustomer)

        // Return success with updated data
        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    profile: {
                        customer_id: updatedCustomer.customer_id,
                        email: updatedCustomer.email,
                        full_name: updatedCustomer.full_name,
                        mobile_number: updatedCustomer.mobile_number,
                        address: {
                            line1: updatedCustomer.address,
                            line2: null,
                            city: updatedCustomer.city,
                            state: updatedCustomer.state,
                            postal_code: updatedCustomer.pincode
                        },
                        updated_at: updatedCustomer.updated_at
                    },
                    analytics: {
                        profile_completion: profileCompletion,
                        fields_updated: Object.keys(updateData).length - 1 // Exclude updated_at
                    }
                },
                message: 'Profile updated successfully'
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
 * Validate profile update data
 */
function validateProfileUpdate(data: any): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    // Validate full_name
    if (data.full_name !== undefined) {
        if (typeof data.full_name !== 'string') {
            errors.push('Full name must be a string')
        } else if (data.full_name.trim().length < 2) {
            errors.push('Full name must be at least 2 characters')
        } else if (data.full_name.trim().length > 100) {
            errors.push('Full name cannot exceed 100 characters')
        }
    }

    // Validate mobile_number
    if (data.mobile_number !== undefined && data.mobile_number !== null) {
        if (typeof data.mobile_number !== 'string') {
            errors.push('Mobile number must be a string')
        } else {
            const cleanedMobile = data.mobile_number.replace(/[\s\-\(\)]/g, '')
            if (!/^\d{10}$/.test(cleanedMobile)) {
                errors.push('Mobile number must be exactly 10 digits')
            }
        }
    }

    // Validate alternative_mobile
    if (data.alternative_mobile !== undefined && data.alternative_mobile !== null) {
        if (typeof data.alternative_mobile !== 'string') {
            errors.push('Alternative mobile number must be a string')
        } else {
            const cleanedMobile = data.alternative_mobile.replace(/[\s\-\(\)]/g, '')
            if (cleanedMobile && !/^\d{10}$/.test(cleanedMobile)) {
                errors.push('Alternative mobile number must be exactly 10 digits')
            }
        }
    }

    // Validate postal_code
    if (data.postal_code !== undefined && data.postal_code !== null) {
        if (typeof data.postal_code !== 'string') {
            errors.push('Postal code must be a string')
        } else {
            const cleanedPostal = data.postal_code.replace(/\s/g, '')
            if (!/^\d{6}$/.test(cleanedPostal)) {
                errors.push('Postal code must be exactly 6 digits')
            }
        }
    }

    // Validate address fields length
    if (data.address_line1 !== undefined && data.address_line1?.length > 255) {
        errors.push('Address line 1 cannot exceed 255 characters')
    }
    if (data.door_no !== undefined && data.door_no?.length > 50) {
        errors.push('Door No cannot exceed 50 characters')
    }
    if (data.street !== undefined && data.street?.length > 255) {
        errors.push('Street name cannot exceed 255 characters')
    }
    if (data.district !== undefined && data.district?.length > 100) {
        errors.push('District name cannot exceed 100 characters')
    }
    if (data.city !== undefined && data.city?.length > 100) {
        errors.push('City name cannot exceed 100 characters')
    }
    if (data.state !== undefined && data.state?.length > 100) {
        errors.push('State name cannot exceed 100 characters')
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    }
}

/**
 * Calculate profile completion percentage
 */
function calculateProfileCompletion(customer: any): number {
    const fields = [
        customer.full_name,
        customer.mobile_number,
        customer.door_no,
        customer.street,
        customer.city,
        customer.district,
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
