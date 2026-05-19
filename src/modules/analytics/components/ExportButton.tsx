'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExportButtonProps {
    data: any[];
    filename: string;
    pdfElementId?: string; // ID of the container to print
}

export function ExportButton({ data, filename, pdfElementId }: ExportButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleExportExcel = () => {
        try {
            if (!data || data.length === 0) {
                alert('No data to export');
                return;
            }
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
            XLSX.writeFile(workbook, `${filename}.xlsx`);
        } catch (error) {
            console.error('Excel export failed:', error);
            alert('Export failed');
        }
        setIsOpen(false);
    };

    const handlePrintPdf = () => {
        if (pdfElementId) {
            // Very simple PDF/Print solution: trigger browser print.
            // For a complex dashboard, window.print() combined with @media print CSS is often the cleanest native way
            // without requiring heavy html2pdf libraries.
            window.print();
        } else {
            alert('PDF export not configured for this report yet.');
        }
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block text-left">
            <Button
                variant="outline"
                onClick={() => setIsOpen(!isOpen)}
                className="bg-white"
            >
                <Download className="h-4 w-4 mr-2" />
                Export Report
            </Button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            role="menuitem"
                        >
                            <FileSpreadsheet className="mr-3 h-4 w-4 text-green-600" />
                            Export as Excel
                        </button>
                        <button
                            onClick={handlePrintPdf}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                            role="menuitem"
                        >
                            <Printer className="mr-3 h-4 w-4 text-red-600" />
                            Print / Save PDF
                        </button>
                    </div>
                </div>
            )}
            
            {/* Click outside listener could be added here or in a wrapper, 
                for now a simple toggle works */}
        </div>
    );
}
