export function createOrderConfirmationEmail(orderDetails: {
    order_id: string;
    customer_name: string;
    customer_email: string;
    items: Array<{
        variant_name: string;
        quantity: number;
        saleprice: number;
    }>;
    total_amount: number;
    shipping_amount: number;
    shipping_address: {
        full_name: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
        mobile: string;
    };
    payment_method: string;
}) {
    const subtotal = orderDetails.total_amount - orderDetails.shipping_amount;

    return {
        subject: `Order Confirmation - ${orderDetails.order_id}`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #9333ea 0%, #db2777 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background: #f9fafb;
            padding: 30px;
        }
        .order-info {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .order-items {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .item {
            padding: 15px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .item:last-child {
            border-bottom: none;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
        }
        .total-row.final {
            font-weight: bold;
            font-size: 18px;
            border-top: 2px solid #e5e7eb;
            padding-top: 15px;
            margin-top: 10px;
        }
        .button {
            display: inline-block;
            background: #9333ea;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0;">Rajashree Fashion</h1>
        <p style="margin: 10px 0 0 0;">Thank you for your order!</p>
    </div>
    
    <div class="content">
        <div class="order-info">
            <h2 style="margin-top: 0; color: #9333ea;">Order Confirmed</h2>
            <p>Hi ${orderDetails.customer_name},</p>
            <p>Your order has been confirmed and will be processed soon.</p>
            
            <table style="width: 100%; margin: 15px 0;">
                <tr>
                    <td style="padding: 5px 0;"><strong>Order ID:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">${orderDetails.order_id}</td>
                </tr>
                <tr>
                    <td style="padding: 5px 0;"><strong>Payment Method:</strong></td>
                    <td style="padding: 5px 0; text-align: right;">${orderDetails.payment_method === 'COD' ? 'Cash on Delivery' : orderDetails.payment_method}</td>
                </tr>
            </table>
        </div>

        <div class="order-items">
            <h3 style="margin-top: 0; color: #374151;">Order Items</h3>
            ${orderDetails.items.map(item => `
                <div class="item">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>${item.variant_name}</strong><br>
                            <span style="color: #6b7280;">Qty: ${item.quantity}</span>
                        </div>
                        <div style="text-align: right;">
                            ₹${item.saleprice.toFixed(2)}<br>
                            <strong>₹${(item.saleprice * item.quantity).toFixed(2)}</strong>
                        </div>
                    </div>
                </div>
            `).join('')}

            <div style="margin-top: 20px;">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>₹${subtotal.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>Shipping:</span>
                    <span>₹${orderDetails.shipping_amount.toFixed(2)}</span>
                </div>
                <div class="total-row final">
                    <span>Total:</span>
                    <span>₹${orderDetails.total_amount.toFixed(2)}</span>
                </div>
            </div>
        </div>

        <div class="order-info">
            <h3 style="margin-top: 0; color: #374151;">Shipping Address</h3>
            <p style="margin: 5px 0;">
                ${orderDetails.shipping_address.full_name}<br>
                ${orderDetails.shipping_address.address}<br>
                ${orderDetails.shipping_address.city}, ${orderDetails.shipping_address.state} - ${orderDetails.shipping_address.pincode}<br>
                ${orderDetails.shipping_address.mobile}
            </p>
        </div>

        <div style="text-align: center;">
            <a href="https://yourdomain.com/my-orders" class="button">View Order Status</a>
        </div>
    </div>

    <div class="footer">
        <p>If you have any questions, please contact us at support@rajashreefashion.com</p>
        <p style="margin: 10px 0 0 0;">&copy; ${new Date().getFullYear()} Rajashree Fashion. All rights reserved.</p>
    </div>
</body>
</html>
        `
    };
}
