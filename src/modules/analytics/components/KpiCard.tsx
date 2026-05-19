import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
    title: string;
    value: string | number;
    icon: ReactNode;
    trend?: number; // percentage, positive for up, negative for down
    trendLabel?: string;
    colorClass?: string; // e.g. 'text-blue-600', 'bg-blue-100'
}

export function KpiCard({ title, value, icon, trend, trendLabel, colorClass = 'text-indigo-600' }: KpiCardProps) {
    const isPositive = trend !== undefined && trend > 0;
    const isNegative = trend !== undefined && trend < 0;
    const isNeutral = trend !== undefined && trend === 0;

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <div className={`p-2 rounded-lg ${colorClass.replace('text-', 'bg-').replace('600', '100')} ${colorClass}`}>
                        {icon}
                    </div>
                </div>
                
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                </div>

                {trend !== undefined && (
                    <div className="mt-2 flex items-center text-sm">
                        {isPositive && <TrendingUp className="h-4 w-4 text-green-600 mr-1" />}
                        {isNegative && <TrendingDown className="h-4 w-4 text-red-600 mr-1" />}
                        {isNeutral && <Minus className="h-4 w-4 text-gray-500 mr-1" />}
                        
                        <span className={`font-medium ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
                            {Math.abs(trend).toFixed(1)}%
                        </span>
                        {trendLabel && <span className="text-gray-500 ml-1.5">{trendLabel}</span>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
