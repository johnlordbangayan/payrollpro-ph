import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Draws a single payslip in a 105x99mm grid (6 per A4 page)
 */
const drawGriddedPayslip = (doc, org, record, offsetX, offsetY) => {
  const margin = 8; 
  const payslipWidth = 105; 
  const contentWidth = payslipWidth - (margin * 2); 

  // 1. HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(org?.name?.toUpperCase() || "PAYROLL ADVICE", offsetX + (payslipWidth / 2), offsetY + 10, { align: "center" });
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`PERIOD: ${record.period_start} TO ${record.period_end}`, offsetX + (payslipWidth / 2), offsetY + 14, { align: "center" });

  const monthlyRate = parseFloat(record.employees?.salary_rate) || 0;
  const factor = parseFloat(org?.working_days_per_year) || 313;
  const dailyRate = (monthlyRate * 12) / factor;
  const hourlyRate = dailyRate / 8;

  // 2. EMPLOYEE INFO (Grid Style)
  autoTable(doc, {
    startY: offsetY + 18,
    margin: { left: offsetX + margin },
    tableWidth: contentWidth,
    theme: 'plain',
    styles: { fontSize: 6.5, cellPadding: 0.5 },
    columnStyles: { 0: { fontStyle: 'bold', width: 15 }, 2: { fontStyle: 'bold', width: 15 } },
    body: [
      ['NAME:', `${(record.employees?.last_name || '').toUpperCase()}, ${record.employees?.first_name}`, 'DEPT:', (record.employees?.department || '').toUpperCase()],
      ['ID NO:', record.employees?.employee_id_number || '---', 'RATE:', `P${dailyRate.toLocaleString(undefined, {minimumFractionDigits: 2})}`],
    ],
  });

  // 3. PAYROLL LOGIC (Earnings vs Deductions)
  const activeAdd = (org?.addition_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_additions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Add Pay") && item.val !== 0);

  const activeDed = (org?.deduction_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_deductions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Deduction") && item.val !== 0);

  const regHolOTPay = (Number(record.reg_holiday_ot_hrs || 0) * hourlyRate * 2.6);
  const specHolOTPay = (Number(record.spec_holiday_ot_hrs || 0) * hourlyRate * 1.69);
  const totalHolOTPay = regHolOTPay + specHolOTPay;

  const regHolNDPay = (Number(record.reg_holiday_nd || 0) * hourlyRate * 2.0) * 0.10;
  const specHolNDPay = (Number(record.spec_holiday_nd || 0) * hourlyRate * 1.3) * 0.10;
  const totalHolNDPay = regHolNDPay + specHolNDPay;

  const earnings = [
    ['Basic Pay', Number(record.basic_pay || 0).toFixed(2)],
    ['Regular OT', Number(record.ot_pay || 0).toFixed(2)],
    ['Regular ND', Number(record.nd_pay || 0).toFixed(2)],
    ['Holiday Prem', Number(record.holiday_pay || 0).toFixed(2)],
    totalHolOTPay > 0 ? ['Holiday OT', totalHolOTPay.toFixed(2)] : null,
    totalHolNDPay > 0 ? ['Holiday ND', totalHolNDPay.toFixed(2)] : null,
    ...activeAdd.map(a => [a.label, a.val.toFixed(2)])
  ].filter(Boolean);

  const deductions = [
    ['W-Tax', Number(record.tax_deduction || 0).toFixed(2)],
    ['SSS', Number(record.sss_deduction || 0).toFixed(2)],
    ['PhilHealth', Number(record.philhealth_deduction || 0).toFixed(2)],
    ['Pag-IBIG', Number(record.pagibig_deduction || 0).toFixed(2)],
    ['Late/UT', Number(record.time_deduction || 0).toFixed(2)],
    ['Loan/Vale', Number(record.loan_deduction || 0).toFixed(2)],
    ...activeDed.map(d => [d.label, d.val.toFixed(2)])
  ].filter(Boolean);

  const tableBody = [];
  const rowsCount = Math.max(earnings.length, deductions.length);
  for (let i = 0; i < rowsCount; i++) {
    tableBody.push([
      earnings[i] ? earnings[i][0] : '',
      earnings[i] ? earnings[i][1] : '',
      deductions[i] ? deductions[i][0] : '',
      deductions[i] ? deductions[i][1] : ''
    ]);
  }

  // 4. MAIN TABLE
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2,
    margin: { left: offsetX + margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 0.8 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['EARNINGS', 'AMT', 'DEDUCTIONS', 'AMT']],
    body: tableBody,
  });

  // 5. TOTALS & NET PAY
  const finalY = doc.lastAutoTable.finalY + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`GROSS: P${Number(record.gross_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + margin, finalY);
  
  doc.setFillColor(248, 250, 252);
  doc.rect(offsetX + margin, finalY + 2, contentWidth, 7, 'F');
  doc.setFontSize(8);
  doc.text(`NET PAY: P${Number(record.net_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + (payslipWidth / 2), finalY + 7, { align: "center" });

  // 6. CUTTING GUIDES (Dashed)
  doc.setDrawColor(200);
  doc.setLineDashPattern([1, 1], 0);
  // Vertical center line
  doc.line(105, 0, 105, 297);
  // Horizontal lines
  doc.line(0, 99, 210, 99);
  doc.line(0, 198, 210, 198);
  doc.setLineDashPattern([], 0);
};

export const generatePayslipPDF = (org, record) => {
  // Preview for one still uses the gridded box size
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 99] });
  drawGriddedPayslip(doc, org, record, 0, 0);
  window.open(doc.output('bloburl'), '_blank');
};

export const generateBulkPayslips = (org, records) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const itemsPerPage = 6;

    records.forEach((record, index) => {
      const slotIndex = index % itemsPerPage;
      
      if (index > 0 && slotIndex === 0) doc.addPage();

      // Math for 2 columns, 3 rows
      const col = slotIndex % 2; // 0 or 1
      const row = Math.floor(slotIndex / 2); // 0, 1, or 2

      const x = col * 105;
      const y = row * 99;

      drawGriddedPayslip(doc, org, record, x, y);
    });

    window.open(doc.output('bloburl'), '_blank');
  } catch (err) {
    console.error("Bulk PDF Error:", err);
  }
};