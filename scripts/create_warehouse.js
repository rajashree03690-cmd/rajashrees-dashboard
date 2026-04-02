

const DELHI_API_TOKEN = '81b46fee5028f79840ab568b7bf88a65ec6d67ea';
const DELHI_BASE_URL = 'https://staging-express.delhivery.com';
const PICKUP_LOCATION = 'b64af4-ORANGEOWLTEXTILESPRI-do';

async function createWarehouse() {
    const payload = {
        name: PICKUP_LOCATION,
        registered_name: "Rajashree Fashion",
        phone: "9999999999",
        email: "contact@rajashree.com",
        address: "123 Test Address",
        city: "New Delhi",
        state: "Delhi",
        country: "India",
        pin: "110001",
        return_address: "123 Test Address",
        return_pin: "110001",
        return_city: "New Delhi",
        return_state: "Delhi",
        return_country: "India"
    };

    console.log("Registering warehouse on staging...");
    try {
        const res = await fetch(`${DELHI_BASE_URL}/api/backend/clientwarehouse/create/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${DELHI_API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.dir(data, { depth: null, colors: true });

        // Write to a log
        require('fs').writeFileSync('warehouse_create_res.json', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

createWarehouse();
