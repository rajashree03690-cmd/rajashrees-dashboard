const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DelhiveryRequest {
  action:
  | 'create_shipment'
  | 'track_shipment'
  | 'generate_label'
  | 'pickup_request'
  | 'cancel_shipment'
  | 'update_shipment'
  | 'calculate_cost'
  | 'reverse_pickup'
  | 'ndr_action'
  | 'check_pincode'
  | 'list_warehouses';
  payload: any;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const DELHI_BASE_URL = Deno.env.get('DELHIVERY_BASE_URL') || 'https://track.delhivery.com';
    const DELHI_API_TOKEN = Deno.env.get('DELHIVERY_API_KEY') || '';

    if (!DELHI_API_TOKEN) {
      throw new Error('Delhivery API Token is not configured. Set DELHIVERY_API_KEY in Supabase secrets.');
    }

    // Parse request body - strip any non-JSON prefix the runtime may inject
    let requestData: DelhiveryRequest;
    try {
      let bodyText = await req.text();
      // Find the first '{' to handle cases where runtime prepends text
      const jsonStart = bodyText.indexOf('{');
      if (jsonStart > 0) {
        console.warn('Body had non-JSON prefix, stripping:', bodyText.substring(0, jsonStart));
        bodyText = bodyText.substring(jsonStart);
      }
      if (jsonStart < 0) {
        throw new Error('No JSON object found in request body');
      }
      requestData = JSON.parse(bodyText);
    } catch (parseErr: any) {
      throw new Error(`Invalid request body: ${parseErr.message}`);
    }

    const { action, payload } = requestData;

    if (!action) {
      throw new Error('action is required');
    }

    let responseData: any;

    switch (action) {
      case 'create_shipment': {
        const formData = new URLSearchParams();
        formData.append('format', 'json');
        formData.append('data', JSON.stringify(payload));

        const res = await fetch(`${DELHI_BASE_URL}/api/cmu/create.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: formData.toString()
        });
        responseData = await res.json();

        if (!res.ok) {
          throw new Error(`Delhivery API Error: ${res.statusText} - ${JSON.stringify(responseData)}`);
        }
        break;
      }
      case 'track_shipment': {
        const { waybill } = payload;
        if (!waybill) throw new Error("waybill is required for tracking");

        const res = await fetch(`${DELHI_BASE_URL}/api/v1/packages/json/?waybill=${waybill}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Accept': 'application/json'
          }
        });
        responseData = await res.json();
        break;
      }
      case 'generate_label': {
        const { waybill } = payload;
        if (!waybill) throw new Error("waybill is required for label generation");

        // Try to get the combined PDF redirect URL first (works for bulk waybills)
        try {
          const pdfRes = await fetch(`${DELHI_BASE_URL}/api/p/packing_slip?wbns=${waybill}&pdf=true&ss=QC`, {
            method: 'GET',
            headers: {
              'Authorization': `Token ${DELHI_API_TOKEN}`,
            },
            redirect: 'manual'
          });

          // If Delhivery returns a redirect (302), capture the combined PDF URL
          if (pdfRes.status === 301 || pdfRes.status === 302) {
            const combinedPdfUrl = pdfRes.headers.get('location') || pdfRes.headers.get('Location');
            if (combinedPdfUrl) {
              responseData = {
                packages_found: 1,
                combined_pdf: combinedPdfUrl,
                packages: [{ pdf_download_link: combinedPdfUrl }]
              };
              break;
            }
          }
        } catch (redirectErr) {
          console.warn('Redirect capture failed, falling back to JSON:', redirectErr);
        }

        // Fallback: fetch as JSON to get individual package links
        const res = await fetch(`${DELHI_BASE_URL}/api/p/packing_slip?wbns=${waybill}&pdf=true&ss=QC`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Accept': 'application/json'
          }
        });
        responseData = await res.json();
        break;
      }
      case 'pickup_request': {
        const res = await fetch(`${DELHI_BASE_URL}/fm/request/new/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        responseData = await res.json();
        break;
      }

      case 'cancel_shipment': {
        const { waybill } = payload;
        if (!waybill) throw new Error("waybill is required for cancellation");

        const formData = new URLSearchParams();
        formData.append('waybill', waybill);
        formData.append('cancellation', 'true');

        const res = await fetch(`${DELHI_BASE_URL}/api/p/edit`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: formData.toString()
        });
        responseData = await res.json();
        break;
      }

      case 'update_shipment': {
        const { waybill, updates } = payload;
        if (!waybill) throw new Error("waybill is required for update");

        const formData = new URLSearchParams();
        formData.append('waybill', waybill);
        if (updates) {
          Object.entries(updates).forEach(([key, value]) => {
            formData.append(key, String(value));
          });
        }

        const res = await fetch(`${DELHI_BASE_URL}/api/p/edit`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: formData.toString()
        });
        responseData = await res.json();
        break;
      }

      case 'calculate_cost': {
        const { origin_pin, destination_pin, weight, cod_amount, mode } = payload;
        if (!origin_pin || !destination_pin || !weight) {
          throw new Error("origin_pin, destination_pin, and weight are required");
        }

        const params = new URLSearchParams({
          md: mode || 'S',
          cgm: String(weight),
          o_pin: origin_pin,
          d_pin: destination_pin,
          ss: 'Delivered',
        });
        if (cod_amount) params.append('cod', String(cod_amount));

        const res = await fetch(`${DELHI_BASE_URL}/api/kinko/v1/invoice/charges/.json?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Accept': 'application/json'
          }
        });
        responseData = await res.json();
        break;
      }

      case 'reverse_pickup': {
        const res = await fetch(`${DELHI_BASE_URL}/fm/request/new/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            ...payload,
            pickup_type: 'reverse',
          })
        });
        responseData = await res.json();
        break;
      }

      case 'ndr_action': {
        const { waybill, ndr_action: action_code, ndr_comments } = payload;
        if (!waybill || !action_code) {
          throw new Error("waybill and ndr_action are required");
        }

        const formData = new URLSearchParams();
        formData.append('waybill', waybill);
        formData.append('act', action_code);
        if (ndr_comments) formData.append('ndr_comment', ndr_comments);

        const res = await fetch(`${DELHI_BASE_URL}/api/p/update`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: formData.toString()
        });
        responseData = await res.json();
        break;
      }

      case 'check_pincode': {
        const { pincode } = payload;
        if (!pincode) throw new Error("pincode is required for serviceability check");

        const res = await fetch(`${DELHI_BASE_URL}/c/api/pin-codes/json/?filter_codes=${pincode}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHI_API_TOKEN}`,
            'Accept': 'application/json'
          }
        });
        const pincodeData = await res.json();

        const deliveryCodes = pincodeData?.delivery_codes || [];
        const isServiceable = deliveryCodes.length > 0;
        let pincodeInfo: any = { serviceable: isServiceable, pincode };

        if (isServiceable) {
          const postal = deliveryCodes[0]?.postal_code || {};
          pincodeInfo = {
            ...pincodeInfo,
            pre_paid: postal.pre_paid === 'Y',
            cod: postal.cod === 'Y',
            pickup: postal.pickup === 'Y',
            city: postal.district || '',
            state: postal.state_code || '',
            center: postal.center || '',
          };
        }

        responseData = pincodeInfo;
        break;
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Delhivery Edge Function Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unknown error occurred'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
