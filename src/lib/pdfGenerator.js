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

  // 2. EMPLOYEE INFO
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

  // 3. PAYROLL LOGIC (Calculations)
  const activeAdd = (org?.addition_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_additions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Add Pay") && item.val !== 0);

  const activeDed = (org?.deduction_labels || [])
    .map((label, i) => ({ label, val: Number(record.custom_deductions?.[i] || 0) }))
    .filter(item => !item.label.startsWith("Deduction") && item.val !== 0);

  // --- FIXED HOLIDAY MERGE LOGIC ---
  // Since record.holiday_pay ALREADY includes Holiday OT and ND premiums, 
  // we simply use that value directly to avoid double-counting.
  const totalHolidayPay = Number(record.holiday_pay || 0);

  const earnings = [
    ['Basic Pay', Number(record.basic_pay || 0).toFixed(2)],
    ['Regular OT', Number(record.ot_pay || 0).toFixed(2)],
    ['Regular ND', Number(record.nd_pay || 0).toFixed(2)],
    totalHolidayPay > 0 ? ['Holiday Pay', totalHolidayPay.toFixed(2)] : null,
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
    styles: { fontSize: 6.5, cellPadding: 0.8 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
    columnStyles: { 1: { halign: 'right' }, 3: { halign: 'right' } },
    head: [['EARNINGS', 'AMT', 'DEDUCTIONS', 'AMT']],
    body: tableBody,
  });

  // 5. TOTALS & NET PAY
  const finalY = doc.lastAutoTable.finalY + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`GROSS: P${Number(record.gross_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + margin, finalY);
  
  doc.setFillColor(240, 244, 248);
  doc.rect(offsetX + margin, finalY + 2, contentWidth, 8, 'F');
  doc.setFontSize(9);
  doc.text(`NET PAY: P${Number(record.net_pay || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}`, offsetX + (payslipWidth / 2), finalY + 7.5, { align: "center" });

  // 6. CUTTING GUIDES
  doc.setDrawColor(200);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(105, 0, 105, 297); 
  doc.line(0, 99, 210, 99);   
  doc.line(0, 198, 210, 198); 
  doc.setLineDashPattern([], 0);
};

export const generatePayslipPDF = (org, record) => {
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
      const col = slotIndex % 2; 
      const row = Math.floor(slotIndex / 2); 
      const x = col * 105;
      const y = row * 99;
      drawGriddedPayslip(doc, org, record, x, y);
    });

    window.open(doc.output('bloburl'), '_blank');
  } catch (err) {
    console.error("Bulk PDF Error:", err);
  }
};