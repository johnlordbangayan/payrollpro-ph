import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Draws a single payslip at a specific (x, y) offset on an A4 page.
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

  const monthlyRate = parseFloat(record.employees?.salary_rate) || 0;
  const factor = parseFloat(org?.working_days_per_year) || 313;
  const dailyRate = (monthlyRate * 12) / factor;
  const hourlyRate = dailyRate / 8;

  // 2. EMPLOYEE INFO
  autoTable(doc, {
    startY: offsetY + 20,
    margin: { left: offsetX + margin },
    tableWidth: contentWidth,
    theme: 'plain',
    styles: { fontSize: 7, cellPadding: 0.5 },
    columnStyles: { 0: { fontStyle: 'bold', width: 18 }, 2: { fontStyle: 'bold', width: 18 } },
    body: [
      ['Last Name:', (record.employees?.last_name || '').toUpperCase(), 'PHIC:', record.employees?.phic_no || '---'],
      ['First Name:', (record.employees?.first_name || '').toUpperCase(), 'HDMF:', record.employees?.hdmf_no || '---'],
      ['Emp No:', record.employees?.employee_id_number || '---', 'SSS:', record.employees?.sss_no || '---'],
      ['Dept:', (record.employees?.department || '').toUpperCase(), 'Rate:', `P${dailyRate.toLocaleString(undefined, {minimumFractionDigits: 2})}`],
    ],
  });

  // 3. PREPARE DYNAMIC ROWS
  const activeAdd = (org?.addition_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_additions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Add Pay") && item.val !== 0);

  const activeDed = (org?.deduction_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_deductions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Deduction") && item.val !== 0);

  // Holiday OT Logic: Reg (2.6x) + Spec (1.69x)
  const regHolOTPay = (Number(record.reg_holiday_ot_hrs || 0) * hourlyRate * 2.6);
  const specHolOTPay = (Number(record.spec_holiday_ot_hrs || 0) * hourlyRate * 1.69);
  const totalHolOTPay = regHolOTPay + specHolOTPay;

  // Holiday ND Logic: Reg (2.0x * 0.1) + Spec (1.3x * 0.1)
  const regHolNDPay = (Number(record.reg_holiday_nd || 0) * hourlyRate * 2.0) * 0.10;
  const specHolNDPay = (Number(record.spec_holiday_nd || 0) * hourlyRate * 1.3) * 0.10;
  const totalHolNDPay = regHolNDPay + specHolNDPay;

  const earnings = [
    ['Basic Pay', Number(record.basic_pay || 0).toFixed(2)],
    ['Regular OT', Number(record.ot_pay || 0).toFixed(2)], // Updated Label
    ['Regular ND', Number(record.nd_pay || 0).toFixed(2)], // RESTORED: Regular shift ND
    ['Holiday Prem', Number(record.holiday_pay || 0).toFixed(2)],
    totalHolOTPay > 0 ? ['Holiday OT', totalHolOTPay.toFixed(2)] : null,
    totalHolNDPay > 0 ? ['Holiday ND', totalHolNDPay.toFixed(2)] : null,
    ...activeAdd.map(a => [a.label, a.val.toFixed(2)])
  ].filter(Boolean);

  const deductions = [
    ['W-Tax', Number(record.tax_deduction || 0).toFixed(2)],
    ['SSS', Number(record.sss_deduction || 0).toFixed(2)],
    ['PHIC', Number(record.philhealth_deduction || 0).toFixed(2)],
    ['HDMF', Number(record.pagibig_deduction || 0).toFixed(2)],
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
    styles: { fontSize: 6.5, cellPadding: 0.8 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['EARNINGS', 'AMT', 'DEDUCTIONS', 'AMT']],
    body: tableBody,
  });

  // 5. TOTALS
  const finalY = doc.lastAutoTable.finalY + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`GROSS: P${Number(record.gross_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + margin, finalY);
  
  const totalDed = Number(record.gross_pay || 0) - Number(record.net_pay || 0);
  doc.text(`DED: P${totalDed.toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + payslipWidth - margin, finalY, { align: "right" });

  // 6. NET PAY BOX
  doc.setFillColor(248, 250, 252);
  doc.rect(offsetX + margin, finalY + 3, contentWidth, 9, 'F');
  doc.setFontSize(9);
  doc.text(`NET PAY: P${Number(record.net_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + (payslipWidth / 2), finalY + 9, { align: "center" });

  // Cutting Guide
  doc.setDrawColor(230);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(offsetX + payslipWidth, offsetY, offsetX + payslipWidth, offsetY + 148.5); 
  doc.line(offsetX, offsetY + 148.5, offsetX + payslipWidth, offsetY + 148.5); 
  doc.setLineDashPattern([], 0);
};

export const generatePayslipPDF = (org, record) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 148.5] });
  drawGriddedPayslip(doc, org, record, 0, 0);
  window.open(doc.output('bloburl'), '_blank');
};

export const generateBulkPayslips = (org, records) => {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    records.forEach((record, index) => {
      const pageIndex = index % 4;
      if (index > 0 && pageIndex === 0) doc.addPage();
      const x = (pageIndex % 2) * 105;
      const y = Math.floor(pageIndex / 2) * 148.5;
      drawGriddedPayslip(doc, org, record, x, y);
    });
    window.open(doc.output('bloburl'), '_blank');
  } catch (err) {
    console.error("Bulk PDF Error:", err);
  }
};