/**
 * PH DOLE Standard Logic - Updated Feb 2026
 * Fixed: Double-counting (Base Pay) and Multiple Holiday Instance Support
 */
export const calculatePayroll = (emp, config, orgSettings, inputs) => {
  const monthlyRate = parseFloat(emp.salary_rate) || 0;
  const factor = parseFloat(orgSettings?.working_days_per_year) || 313;
  
  const dailyRate = (monthlyRate * 12) / factor;
  const hourlyRate = dailyRate / 8;
  const minuteRate = hourlyRate / 60;

  // --- 1. BASIC EARNINGS (Normal Days) ---
  // This already includes the 100% base pay for any holiday worked
  // as long as the holiday is included in the total daysWorked count.
  const basicPay = dailyRate * (parseFloat(inputs.daysWorked) || 0);

  // --- 2. PREMIUM & HOLIDAY PAY (PREMIUM ONLY) ---
  const regDays = parseFloat(inputs.regHolidayDays) || 0;
  const specDays = parseFloat(inputs.specHolidayDays) || 0;
  const restDayHrs = parseFloat(inputs.restDayHrs) || 0;
  
  const regHolOTHrs = parseFloat(inputs.regHolidayOTHrs) || 0;
  const specHolOTHrs = parseFloat(inputs.specHolidayOTHrs) || 0;
  
  const regNDHrs = parseFloat(inputs.regHolidayND) || 0;
  const specNDHrs = parseFloat(inputs.specHolidayND) || 0;

  /**
   * DOLE PREMIUM LOGIC:
   * Because 100% is in basicPay, we only add the 'Premium' portion here.
   * Regular Holiday: +100% (Total 200%)
   * Special Holiday: +30% (Total 130%)
   * Rest Day: +30% (Total 130%)
   */
  const regHolPremium = (regDays * dailyRate * 1.0);
  const specHolPremium = (specDays * dailyRate * 0.30);
  const restDayPremium = (restDayHrs * hourlyRate * 0.30);

  // HOLIDAY OT (DOLE: 130% of the multiplied Holiday Hourly Rate)
  // Regular Holiday OT: (HourlyRate * 2.0) * 1.3 = 2.6x
  const regHolOTPay = regHolOTHrs * hourlyRate * 2.6;
  
  // Special Holiday OT: (HourlyRate * 1.3) * 1.3 = 1.69x
  const specHolOTPay = specHolOTHrs * hourlyRate * 1.69;

  // HOLIDAY NIGHT DIFFERENTIAL (DOLE: 10% of the multiplied Holiday Hourly Rate)
  const regHolNDPay = (regNDHrs * hourlyRate * 2.0) * 0.10;
  const specHolNDPay = (specNDHrs * hourlyRate * 1.3) * 0.10;

  const holidayPay = regHolPremium + specHolPremium + restDayPremium + 
                     regHolOTPay + specHolOTPay + regHolNDPay + specHolNDPay;

  // --- 3. NORMAL OT & ND (Non-Holiday Work) ---
  const otPay = (hourlyRate * 1.25) * (parseFloat(inputs.otHours) || 0);
  const ndPay = (hourlyRate * 0.10) * (parseFloat(inputs.ndHours) || 0);

  const additionsTotal = (inputs.customAdditions || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  
  const grossPay = basicPay + otPay + ndPay + holidayPay + additionsTotal;

  // --- 4. DEDUCTIONS (Attendance-based) ---
  const lateMinutes = parseInt(inputs.lateMinutes) || 0;
  const undertimeMinutes = parseInt(inputs.undertimeMinutes) || 0;

  const isSpecialLateOrg = orgSettings?.id === '8dc9fa44-6f40-41c1-bef6-417810008dc8';
  const lateMultiplier = isSpecialLateOrg ? 2 : 1;

  const lateDeduction = (minuteRate * lateMultiplier) * lateMinutes;
  const undertimeDeduction = minuteRate * undertimeMinutes;
  const timeDeduction = lateDeduction + undertimeDeduction;

  // --- 5. STATUTORY CONTRIBUTIONS ---
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

  // --- 6. TAX (TRAIN Law Calculation) ---
  const taxable = grossPay - (sssEE + phEE + piEE);
  const taxBrks = config?.tax_table || [];
  const taxBrk = taxBrks.find(t => taxable >= t.min && taxable <= t.max) || { base_tax: 0, min: 0, excess_rate: 0 };
  const taxWH = taxBrk.base_tax + ((taxable - taxBrk.min) * taxBrk.excess_rate);

  // --- 7. TOTALS ---
  const customDeductionsTotal = (inputs.customDeductions || []).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const loanPayment = parseFloat(inputs.loanPayment) || 0;
  const shortDeduction = parseFloat(inputs.short) || 0;
  const cashBond = parseFloat(inputs.cashBond) || 0;
  
  const totalDeductions = sssEE + phEE + piEE + taxWH + timeDeduction + loanPayment + customDeductionsTotal;

  return {
    basicPay, 
    otPay, 
    ndPay, 
    holidayPay, 
    grossPay, 
    sssEE, 
    phEE, 
    piEE, 
    taxWH, 
    timeDeduction,
    netPay: grossPay - totalDeductions
  };
};