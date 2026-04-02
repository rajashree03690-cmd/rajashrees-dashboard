import urllib.request
import urllib.parse
import json

DELHI_API_TOKEN = '81b46fee5028f79840ab568b7bf88a65ec6d67ea'
DELHI_BASE_URL = 'https://staging-express.delhivery.com'
PICKUP_LOCATION = 'b64af4-ORANGEOWLTEXTILESPRI-do'

create_payload = {
    "pickup_location": {
        "name": PICKUP_LOCATION,
        "add": "123 Main St, Tech Park"
    },
    "shipments": [
        {
            "client": "",
            "return_name": "Rajashree Fashion",
            "name": "Arjun Kumar",
            "add": "123 Main St, Tech Park",
            "pin": "110001",
            "city": "New Delhi",
            "state": "Delhi",
            "country": "India",
            "phone": "9999999999",
            "order": "TEST-ORD-1234",
            "payment_mode": "Prepaid",
            "products_desc": "Sample T-Shirt",
            "hsn_code": "6206",
            "cod_amount": "0",
            "order_date": "2023-11-01T12:00:00Z",
            "total_amount": "500",
            "shipping_mode": "Surface",
            "quantity": "1",
            "weight": "500"
        }
    ]
}

data_str = json.dumps(create_payload)
form_data = urllib.parse.urlencode({
    'format': 'json',
    'data': data_str
}).encode('utf-8')

req = urllib.request.Request(
    f"{DELHI_BASE_URL}/api/cmu/create.json",
    data=form_data,
    headers={
        'Authorization': f'Token {DELHI_API_TOKEN}',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    },
    method='POST'
)

try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode('utf-8'))
        with open('delhi_test_err.json', 'w') as f:
            json.dump(res_data, f, indent=2)
        print("Success:", res_data)
except urllib.error.HTTPError as e:
    res_data = json.loads(e.read().decode('utf-8'))
    with open('delhi_test_err.json', 'w') as f:
        json.dump(res_data, f, indent=2)
    print("HTTP Error:", res_data)
except Exception as e:
    print("Error:", e)
