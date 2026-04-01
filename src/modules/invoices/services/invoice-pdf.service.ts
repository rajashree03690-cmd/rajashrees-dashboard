import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const invoicePdfService = {
    /**
     * Download invoice as PDF
     * @param elementId The ID of the HTML element to render (e.g., 'invoice-content')
     * @param fileName The name of the file to save
     */
    async downloadPdf(elementId: string, fileName: string): Promise<boolean> {
        try {
            const element = document.getElementById(elementId);
            if (!element) {
                console.error(`Element with ID ${elementId} not found`);
                return false;
            }

            // Capture the element as a canvas
            const canvas = await html2canvas(element, {
                scale: 2, // Higher scale for better resolution
                useCORS: true, // Allow loading images from other domains if needed
                logging: false,
                backgroundColor: '#ffffff'
            });

            // Calculate dimensions
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            // Add first page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add subsequent pages if content overflows
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save the PDF
            pdf.save(fileName);
            return true;
        } catch (error) {
            console.error('Error generating PDF:', error);
            return false;
        }
    }
};
