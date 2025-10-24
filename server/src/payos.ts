import crypto from 'crypto';

interface PayOSConfig {
    clientId: string;
    apiKey: string;
    checksumKey: string;
}

interface PaymentLinkData {
    orderCode: number;
    amount: number;
    description: string;
    cancelUrl: string;
    returnUrl: string;
    buyerName?: string;
    buyerEmail?: string;
    buyerPhone?: string;
}

interface PayOSResponse {
    code: string;
    desc: string;
    data: {
        bin: string;
        accountNumber: string;
        accountName: string;
        amount: number;
        description: string;
        orderCode: number;
        currency: string;
        paymentLinkId: string;
        status: string;
        checkoutUrl: string;
        qrCode: string;
    };
    signature: string;
}

export class PayOS {
    private config: PayOSConfig;
    private baseURL = 'https://api-merchant.payos.vn';

    constructor(config: PayOSConfig) {
        this.config = config;
    }

    /**
     * Create signature for PayOS API
     * Format: amount={amount}&cancelUrl={cancelUrl}&description={description}&orderCode={orderCode}&returnUrl={returnUrl}
     */
    private createSignature(data: PaymentLinkData): string {
        const sortedData = `amount=${data.amount}&cancelUrl=${data.cancelUrl}&description=${data.description}&orderCode=${data.orderCode}&returnUrl=${data.returnUrl}`;

        return crypto
            .createHmac('sha256', this.config.checksumKey)
            .update(sortedData)
            .digest('hex');
    }

    /**
     * Create payment link with QR code
     */
    async createPaymentLink(data: PaymentLinkData): Promise<PayOSResponse> {
        const signature = this.createSignature(data);

        const requestBody = {
            orderCode: data.orderCode,
            amount: data.amount,
            description: data.description,
            cancelUrl: data.cancelUrl,
            returnUrl: data.returnUrl,
            signature: signature,
            ...(data.buyerName && { buyerName: data.buyerName }),
            ...(data.buyerEmail && { buyerEmail: data.buyerEmail }),
            ...(data.buyerPhone && { buyerPhone: data.buyerPhone }),
        };

        console.log('PayOS Request:', {
            url: `${this.baseURL}/v2/payment-requests`,
            body: requestBody
        });

        const response = await fetch(`${this.baseURL}/v2/payment-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': this.config.clientId,
                'x-api-key': this.config.apiKey,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('PayOS Error:', errorText);
            throw new Error(`PayOS API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json() as PayOSResponse;
        return result;
    }

    /**
     * Get payment link info
     */
    async getPaymentLinkInfo(orderCode: number | string): Promise<any> {
        const response = await fetch(`${this.baseURL}/v2/payment-requests/${orderCode}`, {
            method: 'GET',
            headers: {
                'x-client-id': this.config.clientId,
                'x-api-key': this.config.apiKey,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('PayOS Error:', errorText);
            throw new Error(`PayOS API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Cancel payment link
     */
    async cancelPaymentLink(orderCode: number | string, reason?: string): Promise<any> {
        const response = await fetch(`${this.baseURL}/v2/payment-requests/${orderCode}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-client-id': this.config.clientId,
                'x-api-key': this.config.apiKey,
            },
            body: JSON.stringify({
                cancellationReason: reason || 'User cancelled',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('PayOS Error:', errorText);
            throw new Error(`PayOS API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(webhookData: any): boolean {
        const { signature, ...data } = webhookData;

        // Sort keys alphabetically and create string
        const sortedKeys = Object.keys(data).sort();
        const dataStr = sortedKeys.map(key => `${key}=${JSON.stringify(data[key])}`).join('&');

        const calculatedSignature = crypto
            .createHmac('sha256', this.config.checksumKey)
            .update(dataStr)
            .digest('hex');

        return calculatedSignature === signature;
    }
}

export default PayOS;
