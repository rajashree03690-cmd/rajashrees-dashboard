import React from 'react';
import { CheckCircle, Circle, MapPin, Truck, Package, AlertTriangle } from 'lucide-react';

interface TimelineEvent {
    status: string;
    location: string;
    date: string;
}

interface TrackingData {
    orderId: string;
    awb: string;
    courier: string;
    currentStatus: string;
    lastUpdated: string;
    timeline: TimelineEvent[];
    error?: string;
}

interface TrackingTimelineProps {
    data: TrackingData | null;
    loading: boolean;
}

const statusColorMap: Record<string, string> = {
    'SHIPPED': 'text-blue-600 bg-blue-50 border-blue-200',
    'IN_TRANSIT': 'text-orange-600 bg-orange-50 border-orange-200',
    'OUT_FOR_DELIVERY': 'text-purple-600 bg-purple-50 border-purple-200',
    'DELIVERED': 'text-green-600 bg-green-50 border-green-200',
    'RTO_INITIATED': 'text-red-600 bg-red-50 border-red-200',
    'ORDER_PLACED': 'text-gray-600 bg-gray-50 border-gray-200'
};

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-gray-500">Fetching live tracking updates...</p>
            </div>
        );
    }

    if (!data || data.error) {
        return (
            <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">
                <AlertTriangle className="h-10 w-10 mx-auto mb-2" />
                <p>{data?.error || 'Tracking information unavailable'}</p>
            </div>
        );
    }

    const { currentStatus, courier, awb, timeline } = data;
    const statusStyle = statusColorMap[currentStatus] || statusColorMap['ORDER_PLACED'];

    return (
        <div className="p-4 space-y-6">
            {/* Header Card */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <p className="text-sm text-gray-500 mb-1">Tracking Number (AWB)</p>
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-lg text-gray-800">{awb}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">{courier}</span>
                    </div>
                </div>

                <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${statusStyle}`}>
                    <Truck className="h-4 w-4" />
                    <span className="font-semibold text-sm uppercase tracking-wide">{currentStatus.replace(/_/g, ' ')}</span>
                </div>
            </div>

            {/* Timeline */}
            <div className="px-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Shipment Journey
                </h3>

                <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pb-4">
                    {timeline && timeline.map((event, idx) => {
                        const isLatest = idx === 0; // Assuming timeline comes sorted newest first

                        return (
                            <div key={idx} className="relative pl-6">
                                {/* Dot */}
                                <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center
                                    ${isLatest ? 'border-primary' : 'border-gray-300'}`}>
                                    <div className={`h-2 w-2 rounded-full ${isLatest ? 'bg-primary' : 'bg-gray-300'}`} />
                                </div>

                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                    <div>
                                        <p className={`text-sm font-medium ${isLatest ? 'text-gray-900' : 'text-gray-500'}`}>
                                            {event.status}
                                        </p>
                                        <p className="text-xs text-gray-400">{event.location}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                                        {new Date(event.date).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {timeline?.length === 0 && (
                        <p className="text-sm text-gray-400 pl-6 italic">No tracking events recorded yet.</p>
                    )}
                </div>
            </div>

            <div className="text-center">
                <p className="text-xs text-gray-300 mt-4">Powered by {courier}</p>
            </div>
        </div>
    );
};
