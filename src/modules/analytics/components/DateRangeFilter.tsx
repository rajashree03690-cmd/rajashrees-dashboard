'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronDown } from 'lucide-react';

export type DatePreset = '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRangeFilterProps {
    dateFrom: Date;
    dateTo: Date;
    onDateChange: (from: Date, to: Date, preset: DatePreset) => void;
}

const presets: { key: DatePreset; label: string }[] = [
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: 'thisMonth', label: 'This Month' },
    { key: 'lastMonth', label: 'Last Month' },
    { key: 'custom', label: 'Custom Range' },
];

function getPresetDates(preset: DatePreset): { from: Date; to: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (preset) {
        case '7d': {
            const from = new Date(today);
            from.setDate(from.getDate() - 6);
            return { from, to: today };
        }
        case '30d': {
            const from = new Date(today);
            from.setDate(from.getDate() - 29);
            return { from, to: today };
        }
        case 'thisMonth': {
            const from = new Date(today.getFullYear(), today.getMonth(), 1);
            return { from, to: today };
        }
        case 'lastMonth': {
            const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const to = new Date(today.getFullYear(), today.getMonth(), 0);
            return { from, to };
        }
        default:
            return { from: today, to: today };
    }
}

export function DateRangeFilter({ dateFrom, dateTo, onDateChange }: DateRangeFilterProps) {
    const [activePreset, setActivePreset] = useState<DatePreset>('30d');
    const [showCustom, setShowCustom] = useState(false);

    const handlePreset = (preset: DatePreset) => {
        setActivePreset(preset);
        if (preset === 'custom') {
            setShowCustom(true);
            return;
        }
        setShowCustom(false);
        const { from, to } = getPresetDates(preset);
        onDateChange(from, to, preset);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {presets.filter(p => p.key !== 'custom').map(p => (
                    <button
                        key={p.key}
                        onClick={() => handlePreset(p.key)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                            activePreset === p.key
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
            <button
                onClick={() => handlePreset('custom')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activePreset === 'custom'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:text-gray-900'
                }`}
            >
                Custom <ChevronDown className="h-3 w-3" />
            </button>

            {showCustom && (
                <div className="flex items-center gap-2 ml-2">
                    <input
                        type="date"
                        value={dateFrom.toISOString().split('T')[0]}
                        onChange={e => {
                            const d = new Date(e.target.value);
                            onDateChange(d, dateTo, 'custom');
                        }}
                        className="px-2 py-1 text-xs border rounded-md"
                    />
                    <span className="text-xs text-gray-400">to</span>
                    <input
                        type="date"
                        value={dateTo.toISOString().split('T')[0]}
                        onChange={e => {
                            const d = new Date(e.target.value);
                            onDateChange(dateFrom, d, 'custom');
                        }}
                        className="px-2 py-1 text-xs border rounded-md"
                    />
                </div>
            )}

            <span className="text-xs text-gray-400 ml-2">
                {dateFrom.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {dateTo.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
        </div>
    );
}

export { getPresetDates };
