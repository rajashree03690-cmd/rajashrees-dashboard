const DELHI_API_TOKEN = '81b46fee5028f79840ab568b7bf88a65ec6d67ea';
const DELHI_BASE_URL = 'https://staging-express.delhivery.com';
const PICKUP_LOCATION = 'b64af4-ORANGEOWLTEXTILESPRI-do';

/**
 * Professional Verification Script for Delhivery API
 * Useful for validating the API contract before UI integration.
 */
async function runTests() {
    console.log("Starting Delhivery API Verification Suite...\n");

    try {
        // 1. Create a Shipment (Waybill)
        console.log("1. Testing AWB Creation...");

        // Random suffix to avoid duplicate order id drops
        const randomSuffix = Math.floor(Math.random() * 1000);
        const orderId = `TEST-ORD-${randomSuffix}`;
        const createPayload = {
            "pickup_location": {
                "name": "b64af4-ORANGEOWLTEXTILESPRI-do"
            },
            "shipments": [
                {
                    "name": "Arjun Kumar",
                    "add": "123 Main St, Tech Park",
                    "pin": "110001",
                    "city": "New Delhi",
                    "state": "Delhi",
                    "country": "India",
                    "phone": "9876543210",
                    "order": orderId,
                    "payment_mode": "Prepaid",
                    "products_desc": "Sample T-Shirt",
                    "hsn_code": "6206",
                    "cod_amount": "0",
                    "order_date": new Date().toISOString(),
                    "total_amount": "500",
                    "shipping_mode": "Surface",
                    "quantity": "1",
                    "weight": "500" // in grams                            
                }
            ]
        };

        const formBody = new URLSearchParams();
        formBody.append('format', 'json');
        formBody.append('data', JSON.stringify(createPayload));

        const createRes = await fetch(`${DELHI_BASE_URL}/api/cmu/create.json`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${DELHI_API_TOKEN}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: formBody.toString()
        });

        const createData = await createRes.json();

        import('fs').then(fs => {
            fs.writeFileSync('delhi_test_err.json', JSON.stringify(createData, null, 2));
            console.log('✅ Response written to delhi_test_err.json');
        });

        console.dir(createData, { depth: null, colors: true });

        if (!createData.success || !createData.packages || createData.packages.length === 0) {
            console.warn("⚠️ AWB Creation might have failed or duplicate order.");
            return; // Stop if creation fails
        }

        const waybill = createData.packages[0].waybill;
        console.log(`AWB Created successfully: ${waybill}\n`);

        // 2. Fetch Label
        console.log("2. Testing Label Generation...");
        const labelRes = await fetch(`${DELHI_BASE_URL}/api/p/packing_slip?wbns=${waybill}&pdf=true`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${DELHI_API_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        const labelData = await labelRes.json();
        console.log("Label Response:", JSON.stringify(labelData, null, 2));
        console.log(`✅ Label fetched successfully\n`);

        // 3. Track Shipment
        console.log("🔍 3. Testing Shipment Tracking...");
        const trackRes = await fetch(`${DELHI_BASE_URL}/api/v1/packages/json/?waybill=${waybill}`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${DELHI_API_TOKEN}`,
                'Accept': 'application/json'
            }
        });
        const trackData = await trackRes.json();
        console.log("Track Response (Summary):", {
            status: trackData?.ShipmentData?.[0]?.Shipment?.Status?.Status,
            Waybill: trackData?.ShipmentData?.[0]?.Shipment?.AWB
        });
        console.log(`✅ Tracking fetched successfully\n`);

        // 4. Pickup Request
        console.log("🚚 4. Testing Pickup Request...");
        const pickupPayload = {
            "pickup_time": "14:00:00",
            "pickup_date": new Date().toISOString().split('T')[0],
            "pickup_location": PICKUP_LOCATION,
            "expected_package_count": 1
        };

        const pickupRes = await fetch(`${DELHI_BASE_URL}/fm/request/new/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${DELHI_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(pickupPayload)
        });
        const pickupData = await pickupRes.json();
        console.log("Pickup Response:", JSON.stringify(pickupData, null, 2));
        console.log(`✅ Pickup requested successfully\n`);

        console.log("All Tests Completed.");
    } catch (e) {
        console.error("Test Suite Error:", e);
    }
}

runTests();
