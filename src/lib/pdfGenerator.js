import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Draws a single payslip at a specific (x, y) offset on an A4 page.
 * Maintains the 1/4 A4 size (105x148.5mm).
 */
const drawGriddedPayslip = (doc, org, record, offsetX, offsetY) => {
  const margin = 10; 
  const payslipWidth = 105; 
  const contentWidth = payslipWidth - (margin * 2); 

  // 1. HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(org?.name?.toUpperCase() || "PAYROLL ADVICE", offsetX + (payslipWidth / 2), offsetY + 12, { align: "center" });
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`PERIOD: ${record.period_start} TO ${record.period_end}`, offsetX + (payslipWidth / 2), offsetY + 16, { align: "center" });

  // Calculate Daily Rate using your Org Settings factor
  const monthlyRate = parseFloat(record.employees?.salary_rate) || 0;
  const factor = parseFloat(org?.working_days_per_year) || 313;
  const dailyRate = (monthlyRate * 12) / factor;

  // 2. EMPLOYEE INFO - Now displaying Daily Rate
  autoTable(doc, {
    startY: offsetY + 20,
    margin: { left: offsetX + margin },
    tableWidth: contentWidth,
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 0.5 },
    columnStyles: { 0: { fontStyle: 'bold', width: 18 }, 2: { fontStyle: 'bold', width: 18 } },
    body: [
      ['Last Name:', record.employees?.last_name?.toUpperCase(), 'PHIC:', record.employees?.phic_no || '---'],
      ['First Name:', record.employees?.first_name?.toUpperCase(), 'HDMF:', record.employees?.hdmf_no || '---'],
      ['Emp No:', record.employees?.employee_id_number || '---', 'SSS:', record.employees?.sss_no || '---'],
      ['Dept:', record.employees?.department?.toUpperCase() || '---', 'Daily Rate:', `P${dailyRate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
    ],
  });

  // 3. TABLE DATA - Updating Holiday to show actual value
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2,
    margin: { left: offsetX + margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['EARNINGS', 'AMT', 'DEDUCTIONS', 'AMT']],
    body: [
      ['Basic Pay', Number(record.basic_pay).toFixed(2), 'W-Tax', Number(record.tax_deduction).toFixed(2)],
      ['Overtime', Number(record.ot_pay).toFixed(2), 'SSS', Number(record.sss_deduction).toFixed(2)],
      ['Night Diff', Number(record.nd_pay || 0).toFixed(2), 'PHIC', Number(record.philhealth_deduction).toFixed(2)],
      ['Holiday', Number(record.holiday_pay || 0).toFixed(2), 'HDMF', Number(record.pagibig_deduction).toFixed(2)],
      ['', '', 'Late/UT', Number(record.time_deduction || 0).toFixed(2)],
      ['', '', 'Loan/Vale', Number(record.loan_deduction).toFixed(2)],
      ['', '', org.deduction_labels?.[0] || 'Short', Number(record.custom_deductions?.[0] || 0).toFixed(2)],
      ['', '', org.deduction_labels?.[1] || 'Cash Bond', Number(record.custom_deductions?.[1] || 0).toFixed(2)],
    ],
  });

  // 4. ALIGNED TOTALS
  const finalY = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  
  doc.text(`GROSS: P${Number(record.gross_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + margin, finalY);
  
  const totalDed = Number(record.gross_pay) - Number(record.net_pay);
  doc.text(`DED: P${totalDed.toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + payslipWidth - margin, finalY, { align: "right" });

  // 5. NET PAY BOX (Perfect Margin Alignment)
  doc.setDrawColor(200);
  doc.setFillColor(248, 250, 252);
  doc.rect(offsetX + margin, finalY + 4, contentWidth, 10, 'FD');
  
  doc.setFontSize(9);
  doc.text(`NET PAY: P${Number(record.net_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + (payslipWidth / 2), finalY + 10.5, { align: "center" });

  // Cutting Guide (Light grey dotted line)
  doc.setDrawColor(230);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(offsetX, offsetY, offsetX + payslipWidth, offsetY); // Top border
  doc.line(offsetX, offsetY, offsetX, offsetY + 148.5); // Left border
  doc.setLineDashPattern([], 0);
};

// SINGLE VIEW - Keeps A6 size for individual check
export const generatePayslipPDF = (org, record) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 148.5] });
  drawGriddedPayslip(doc, org, record, 0, 0);
  window.open(doc.output('bloburl'), '_blank');
};

// BULK VIEW - Standard A4 with 2x2 Grid Logic
export const generateBulkPayslips = (org, records) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    records.forEach((record, index) => {
      // Calculate grid position (0, 1, 2, 3)
      const pageIndex = index % 4;
      
      // If we are starting a new A4 page (after every 4th payslip)
      if (index > 0 && pageIndex === 0) {
        doc.addPage();
      }

      // X: 0 for left column, 105 for right column
      const x = (pageIndex % 2) * 105;
      // Y: 0 for top row, 148.5 for bottom row
      const y = Math.floor(pageIndex / 2) * 148.5;

      drawGriddedPayslip(doc, org, record, x, y);
    });

    window.open(doc.output('bloburl'), '_blank');
  } catch (err) {
    console.error("Bulk Grid Error:", err);
    alert("Could not generate bulk grid.");
  }
};