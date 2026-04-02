import { Badge } from '@/components/ui/badge';

interface RefundStatusBadgeProps {
    status: 'none' | 'partial' | 'processing' | 'refunded' | 'failed';
    amount?: number;
}

export function RefundStatusBadge({ status, amount }: RefundStatusBadgeProps) {
    const variants: Record<typeof status, { label: string; className: string }> = {
        none: {
            label: 'No Refund',
            className: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
        },
        processing: {
            label: 'Refund Processing',
            className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
        },
        partial: {
            label: 'Partially Refunded',
            className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
        },
        refunded: {
            label: 'Refunded',
            className: 'bg-green-100 text-green-800 hover:bg-green-100',
        },
        failed: {
            label: 'Refund Failed',
            className: 'bg-red-100 text-red-800 hover:bg-red-100',
        },
    };

    const config = variants[status];

    return (
        <Badge className={config.className}>
            {config.label}
            {amount && amount > 0 && ` (₹${amount.toFixed(2)})`}
        </Badge>
    );
}
