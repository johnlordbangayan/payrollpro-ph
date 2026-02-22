import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Draws a single payslip optimized for 6-per-page (approx 49.5mm height)
 * Separates Regular OT and Regular ND as requested.
 */
const drawCompactPayslip = (doc, org, record, offsetX, offsetY) => {
  const margin = 10;
  const payslipWidth = 210; 
  const payslipHeight = 49.5; 
  const contentWidth = payslipWidth - (margin * 2);

  // 1. HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(org?.name?.toUpperCase() || "PAYROLL ADVICE", offsetX + margin, offsetY + 6);
  
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`PERIOD: ${record.period_start} TO ${record.period_end}`, offsetX + margin, offsetY + 9);

  // Calculate Rates
  const monthlyRate = parseFloat(record.employees?.salary_rate) || 0;
  const factor = parseFloat(org?.working_days_per_year) || 313;
  const dailyRate = (monthlyRate * 12) / factor;
  const hourlyRate = dailyRate / 8;

  // 2. EMPLOYEE INFO (Tight row)
  autoTable(doc, {
    startY: offsetY + 10,
    margin: { left: offsetX + margin },
    tableWidth: contentWidth,
    theme: 'plain',
    styles: { fontSize: 6.5, cellPadding: 0.2 },
    body: [[
      `Name: ${(record.employees?.last_name || '').toUpperCase()}, ${record.employees?.first_name}`,
      `ID: ${record.employees?.employee_id_number || '---'}`,
      `Dept: ${(record.employees?.department || '').toUpperCase()}`,
      `Rate: P${dailyRate.toLocaleString(undefined, {minimumFractionDigits: 2})}`
    ]],
  });

  // 3. PREPARE DYNAMIC ROWS
  const activeAdd = (org?.addition_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_additions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Add Pay") && item.val !== 0);

  const activeDed = (org?.deduction_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_deductions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Deduction") && item.val !== 0);

  // Holiday Logic (Kept your logic exactly as is)
  const regHolOTPay = (Number(record.reg_holiday_ot_hrs || 0) * hourlyRate * 2.6);
  const specHolOTPay = (Number(record.spec_holiday_ot_hrs || 0) * hourlyRate * 1.69);
  const totalHolOTPay = regHolOTPay + specHolOTPay;

  const regHolNDPay = (Number(record.reg_holiday_nd || 0) * hourlyRate * 2.0) * 0.10;
  const specHolNDPay = (Number(record.spec_holiday_nd || 0) * hourlyRate * 1.3) * 0.10;
  const totalHolNDPay = regHolNDPay + specHolNDPay;

  const earnings = [
    ['Basic Pay', Number(record.basic_pay || 0).toFixed(2)],
    ['Regular OT', Number(record.ot_pay || 0).toFixed(2)], // SEPARATED
    ['Regular ND', Number(record.nd_pay || 0).toFixed(2)], // SEPARATED
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

  // 4. MAIN TABLE (Optimized for height)
  autoTable(doc, {
    startY: offsetY + 14,
    margin: { left: offsetX + margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 0.4 }, // Very tight padding to fit rows
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['EARNINGS', 'AMT', 'DEDUCTIONS', 'AMT']],
    body: tableBody,
  });

  // 5. TOTALS (Positioned to avoid overlap)
  const finalY = doc.lastAutoTable.finalY + 3.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`GROSS: P${Number(record.gross_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + margin, finalY);
  
  // Net Pay Box
  doc.setFillColor(245, 245, 245);
  doc.rect(offsetX + (payslipWidth - 70), finalY - 2.5, 60, 4.5, 'F');
  doc.text(`NET PAY: P${Number(record.net_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + (payslipWidth - 68), finalY + 0.8);

  // 6. CUTTING GUIDE
  doc.setDrawColor(220);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(0, offsetY + payslipHeight, 210, offsetY + payslipHeight);
  doc.setLineDashPattern([], 0);
};

export const generatePayslipPDF = (org, record) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [210, 49.5] });
  drawCompactPayslip(doc, org, record, 0, 0);
  window.open(doc.output('bloburl'), '_blank');
};

export const generateBulkPayslips = (org, records) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const itemsPerPage = 6;
    const slotHeight = 49.5;

    records.forEach((record, index) => {
      const slotIndex = index % itemsPerPage;
      if (index > 0 && slotIndex === 0) doc.addPage();
      const y = slotIndex * slotHeight;
      drawCompactPayslip(doc, org, record, 0, y);
    });

    window.open(doc.output('bloburl'), '_blank');
  } catch (err) {
    console.error("Bulk PDF Error:", err);
  }
};