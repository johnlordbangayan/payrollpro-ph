/**
 * PH DOLE Standard Logic - Updated Feb 2026
 * Featuring: SSS Fixed Amount Override & Org-Specific Late Penalty
 */
export const calculatePayroll = (emp, config, orgSettings, inputs) => {
  const monthlyRate = parseFloat(emp.salary_rate) || 0;
  const factor = parseFloat(orgSettings?.working_days_per_year) || 313;
  
  const dailyRate = (monthlyRate * 12) / factor;
  const hourlyRate = dailyRate / 8;
  const minuteRate = hourlyRate / 60;

  // --- 1. EARNINGS ---
  const basicPay = dailyRate * (parseFloat(inputs.daysWorked) || 0);
  const otPay = (hourlyRate * 1.25) * (parseFloat(inputs.otHours) || 0);
  const ndPay = (hourlyRate * 0.10) * (parseFloat(inputs.ndHours) || 0);

  let holidayPay = 0;
  if (inputs.holidaysWorked) {
    inputs.holidaysWorked.forEach(h => {
      if (h.type === 'Regular') holidayPay += dailyRate; 
      else holidayPay += dailyRate * 0.30;
    });
  }

  const additionsTotal = (inputs.customAdditions || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const grossPay = basicPay + otPay + ndPay + holidayPay + additionsTotal;

  // --- 2. DEDUCTIONS (Attendance-based) ---
  const lateMinutes = parseInt(inputs.lateMinutes) || 0;
  const undertimeMinutes = parseInt(inputs.undertimeMinutes) || 0;

  // LOGIC UPDATE: Apply x2 Multiplier for Specific Organization ID
  const isSpecialLateOrg = orgSettings?.id === '8dc9fa44-6f40-41c1-bef6-417810008dc8';
  const lateMultiplier = isSpecialLateOrg ? 2 : 1;

  const lateDeduction = (minuteRate * lateMultiplier) * lateMinutes;
  const undertimeDeduction = minuteRate * undertimeMinutes;
  
  const timeDeduction = lateDeduction + undertimeDeduction;

  // --- 3. STATUTORY CONTRIBUTIONS ---
  const fixedSSS = parseFloat(orgSettings?.fixed_sss_amount);
  
  const baseSSS = (!isNaN(fixedSSS) && fixedSSS > 0)
    ? fixedSSS 
    : (() => {
        if (!config?.sss_table) return 0;
        const sssEntry = config.sss_table.find(b => monthlyRate >= b.min && monthlyRate <= b.max) 
                         || config.sss_table[config.sss_table.length - 1];
        return (sssEntry?.ee_ss || 0) + (sssEntry?.ee_mpf || 0);
      })();

  const basePH = parseFloat(config?.philhealth?.ee_fixed) || 0;
  const basePI = parseFloat(config?.pagibig?.ee_fixed) || 0;

  const getMultiplier = (mode) => {
    if (mode === 'full') return 1;
    if (mode === 'half') return 0.5;
    return 0;
  };

  const sssEE = baseSSS * getMultiplier(inputs.sssMode);
  const phEE = basePH * getMultiplier(inputs.phMode);
  const piEE = basePI * getMultiplier(inputs.piMode);

  // --- 4. TAX (TRAIN Law Calculation) ---
  const taxable = grossPay - (sssEE + phEE + piEE);
  const taxBrks = config?.tax_table || [];
  const taxBrk = taxBrks.find(t => taxable >= t.min && taxable <= t.max) || { base_tax: 0, min: 0, excess_rate: 0 };
  const taxWH = taxBrk.base_tax + ((taxable - taxBrk.min) * taxBrk.excess_rate);

  // --- 5. TOTALS ---
  const customDeductionsTotal = (inputs.customDeductions || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const loanPayment = parseFloat(inputs.loanPayment) || 0;
  
  const totalDeductions = sssEE + phEE + piEE + taxWH + timeDeduction + loanPayment + customDeductionsTotal;

  return {
    basicPay, otPay, ndPay, holidayPay, grossPay, 
    sssEE, phEE, piEE, taxWH, timeDeduction,
    netPay: grossPay - totalDeductions
  };
};