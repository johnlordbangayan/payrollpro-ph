import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { calculatePayroll } from '../lib/payrollLogic';

export default function PayrollDashboard({ organizationId, orgSettings }) {
  // --- [SECTION 1: STATE MANAGEMENT] ---
  const [employees, setEmployees] = useState([]);
  const [config, setConfig] = useState(null);
  const [holidays, setHolidays] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [isStarted, setIsStarted] = useState(false);
  const [payrollEntries, setPayrollEntries] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const [deductionModes, setDeductionModes] = useState({
    sss: 'full', ph: 'full', pi: 'full'
  });

  // --- [SECTION 2: DATA FETCHING WITH TAB-FOCUS SYNC] ---
  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading && employees.length === 0) setLoading(true);
    try {
      const [confRes, empRes, holRes, loanRes] = await Promise.all([
        supabase.from('payroll_config').select('*'),
        supabase.from('employees').select('*').eq('organization_id', organizationId).eq('employment_status', 'Active'),
        supabase.from('holidays').select('*').or(`organization_id.is.null,organization_id.eq.${organizationId}`),
        supabase.from('loans').select('employee_id, balance, monthly_installment').eq('organization_id', organizationId).eq('is_active', true)
      ]);

      const configObj = confRes.data?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
      setConfig(configObj);

      const loanMap = loanRes.data?.reduce((acc, curr) => ({ 
        ...acc, 
        [curr.employee_id]: { balance: curr.balance, installment: curr.monthly_installment } 
      }), {});

      const sortedEmployees = (empRes.data || []).sort((a, b) => {
        const deptA = (a.department || '').toUpperCase();
        const deptB = (b.department || '').toUpperCase();
        if (deptA < deptB) return -1;
        if (deptA > deptB) return 1;
        return (a.last_name || '').localeCompare(b.last_name || '');
      });

      setEmployees(sortedEmployees);
      setHolidays(holRes.data || []);

      // MERGE LOGIC: Updates setup data (loans/holidays) without wiping your current typing
      setPayrollEntries(prev => {
        const updated = { ...prev };
        sortedEmployees.forEach(e => {
          if (!updated[e.id]) {
            const loanData = loanMap[e.id] || { balance: 0, installment: 0 };
            updated[e.id] = { 
              daysWorked: 0, otHours: 0, ndHours: 0, lateMinutes: 0, undertimeMinutes: 0,
              loanPayment: loanData.installment || 0,
              loanBalance: loanData.balance || 0,
              loanMode: 'full',
              customDeductions: [0, 0, 0, 0, 0],
              customAdditions: [0, 0, 0],
              deductSSS: true, deductPH: true, deductPI: true,
              regHolidayDays: 0, regHolidayOTHrs: 0, regHolidayND: 0,
              specHolidayDays: 0, specHolidayOTHrs: 0, specHolidayND: 0,
              restDayHrs: 0, showHolidayPanel: false 
            };
          }
        });
        return updated;
      });
    } catch (err) { console.error("Fetch Error:", err); } 
    finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => {
    fetchData();
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && !saving) {
        fetchData(false); // Background refresh
      }
    };
    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [fetchData, saving]);

  // --- [SECTION 3: HANDLERS] ---
  const activeHolidays = holidays.filter(h => h.holiday_date >= period.start && h.holiday_date <= period.end);

  const handleInputChange = (empId, field, value, index = null) => {
    setPayrollEntries(prev => {
      const updated = { ...prev[empId] };
      if (index !== null) {
        const newList = [...updated[field]];
        newList[index] = parseFloat(value) || 0;
        updated[field] = newList;
      } else { updated[field] = value; }
      return { ...prev, [empId]: updated };
    });
  };

  // RESTORED: Template Download Logic
  const downloadTemplate = () => {
    const activeAdds = (orgSettings?.addition_labels || []).filter(l => !l.startsWith("Add Pay"));
    const activeDeds = (orgSettings?.deduction_labels || []).filter(l => !l.startsWith("Deduction"));
    const headers = [
      "ID_Number", "LastName", "FirstName", "DaysWorked", "OT_Hours", "ND_Hours", 
      "Late_Mins", "Undertime_Mins", "Reg_Hol_Days", "Reg_Hol_OT", "Reg_Hol_ND",
      "Spec_Hol_Days", "Spec_Hol_OT", "Spec_Hol_ND", "Rest_Day_Hrs",
      ...activeAdds, ...activeDeds
    ].join(",");
    const rows = employees.map(e => `${e.employee_id_number},${e.last_name},${e.first_name},0,0,0,0,0,0,0,0,0,0,0,0,${activeAdds.map(()=>0).join(",")},${activeDeds.map(()=>0).join(",")}`);
    const blob = new Blob([headers + "\n" + rows.join("\n")], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payroll_Template_${period.start}.csv`;
    a.click();
  };

  // RESTORED: CSV Import Logic
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rows = event.target.result.split('\n').slice(1);
      setPayrollEntries(prev => {
        const updated = { ...prev };
        rows.forEach(row => {
          if (!row.trim()) return;
          const cols = row.split(',');
          const emp = employees.find(e => String(e.employee_id_number) === cols[0]?.trim());
          if (emp && updated[emp.id]) {
            updated[emp.id] = { ...updated[emp.id], daysWorked: parseFloat(cols[3]) || 0, otHours: parseFloat(cols[4]) || 0, ndHours: parseFloat(cols[5]) || 0, lateMinutes: parseInt(cols[6]) || 0, undertimeMinutes: parseInt(cols[7]) || 0, regHolidayDays: parseFloat(cols[8]) || 0, regHolidayOTHrs: parseFloat(cols[9]) || 0, regHolidayND: parseFloat(cols[10]) || 0, specHolidayDays: parseFloat(cols[11]) || 0, specHolidayOTHrs: parseFloat(cols[12]) || 0, specHolidayND: parseFloat(cols[13]) || 0, restDayHrs: parseFloat(cols[14]) || 0, showHolidayPanel: parseFloat(cols[8]) > 0 || parseFloat(cols[11]) > 0 };
            let colIdx = 15;
            (orgSettings?.addition_labels || []).forEach((l, i) => { if (!l.startsWith("Add Pay")) { updated[emp.id].customAdditions[i] = parseFloat(cols[colIdx]) || 0; colIdx++; } });
            (orgSettings?.deduction_labels || []).forEach((l, i) => { if (!l.startsWith("Deduction")) { updated[emp.id].customDeductions[i] = parseFloat(cols[colIdx]) || 0; colIdx++; } });
          }
        });
        return updated;
      });
      alert("CSV Imported Successfully");
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    const encoded = employees.filter(emp => payrollEntries[emp.id]?.daysWorked > 0 || payrollEntries[emp.id]?.regHolidayDays > 0 || payrollEntries[emp.id]?.specHolidayDays > 0);
    if (encoded.length === 0) return alert("No data to save.");
    if (!window.confirm(`Finalize and save payroll?`)) return;
    setSaving(true);
    try {
        const r = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;
        const payload = encoded.map(emp => {
            const inputs = payrollEntries[emp.id];
            let v = Number(inputs.loanPayment) || 0;
            if (inputs.loanMode === 'half') v /= 2;
            if (inputs.loanMode === 'none') v = 0;
            const safeL = Math.min(v, Number(inputs.loanBalance) || 0);
            const pay = calculatePayroll(emp, config, orgSettings, { ...inputs, loanPayment: safeL, sssMode: inputs.deductSSS ? deductionModes.sss : 'none', phMode: inputs.deductPH ? deductionModes.ph : 'none', piMode: inputs.deductPI ? deductionModes.pi : 'none' });
            return { organization_id: organizationId, employee_id: emp.id, period_start: period.start, period_end: period.end, days_worked: r(inputs.daysWorked), ot_hours: r(inputs.otHours), nd_hours: r(inputs.ndHours), late_minutes: parseInt(inputs.lateMinutes) || 0, undertime_minutes: parseInt(inputs.undertimeMinutes) || 0, reg_holiday_days: r(inputs.regHolidayDays), reg_holiday_ot_hrs: r(inputs.regHolidayOTHrs), reg_holiday_nd: r(inputs.regHolidayND), spec_holiday_days: r(inputs.specHolidayDays), spec_holiday_ot_hrs: r(inputs.specHolidayOTHrs), spec_holiday_nd: r(inputs.specHolidayND), rest_day_hours: r(inputs.restDayHrs), basic_pay: r(pay.basicPay), ot_pay: r(pay.otPay), nd_pay: r(pay.ndPay), holiday_pay: r(pay.holidayPay), time_deduction: r(pay.timeDeduction), gross_pay: r(pay.grossPay), sss_deduction: r(pay.sssEE), philhealth_deduction: r(pay.phEE), pagibig_deduction: r(pay.piEE), tax_deduction: r(pay.taxWH), loan_deduction: r(safeL), net_pay: r(pay.netPay), department: emp.department || 'Unassigned', custom_deductions: inputs.customDeductions.map(v => r(v)), custom_additions: inputs.customAdditions.map(v => r(v)) };
        });
        const { error } = await supabase.from('payroll_history').insert(payload);
        if (error) throw error;
        alert("Payroll finalized!");
        window.location.reload();
    } catch (err) { alert(`Save Error: ${err.message}`); } finally { setSaving(false); }
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.first_name} ${emp.last_name} ${emp.department}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && employees.length === 0) return <div style={msgBox}>Loading System...</div>;

  if (!isStarted) {
    return (
      <div style={setupWrapper}>
        <div style={setupCard}>
          <h2 style={{ marginBottom: '25px', fontSize: '1.5rem', color: '#1e293b' }}>🗓️ New Payroll Run</h2>
          <div style={setupGrid}>
            <div style={inputGroup}><label style={fieldLabel}>START DATE</label><input type="date" value={period.start} onChange={e => setPeriod({...period, start: e.target.value})} style={styledDateInput} /></div>
            <div style={inputGroup}><label style={fieldLabel}>END DATE</label><input type="date" value={period.end} onChange={e => setPeriod({...period, end: e.target.value})} style={styledDateInput} /></div>
          </div>
          <div style={modeSelectionArea}>
             <div style={modeBox}><label style={modeLabel}>SSS</label><select value={deductionModes.sss} onChange={e => setDeductionModes({...deductionModes, sss: e.target.value})} style={modeSelect}><option value="full">Full</option><option value="half">Half</option><option value="none">None</option></select></div>
             <div style={modeBox}><label style={modeLabel}>PHIC</label><select value={deductionModes.ph} onChange={e => setDeductionModes({...deductionModes, ph: e.target.value})} style={modeSelect}><option value="full">Full</option><option value="half">Half</option><option value="none">None</option></select></div>
             <div style={modeBox}><label style={modeLabel}>HDMF</label><select value={deductionModes.pi} onChange={e => setDeductionModes({...deductionModes, pi: e.target.value})} style={modeSelect}><option value="full">Full</option><option value="half">Half</option><option value="none">None</option></select></div>
          </div>
          <button onClick={() => setIsStarted(true)} disabled={!period.start || !period.end} style={period.start && period.end ? startBtn : disabledBtn}>Begin Encoding</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 10px' }}>
      <div style={headerBar}>
        <div><h3 style={{ margin: 0 }}>Run: {period.start} — {period.end}</h3></div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={downloadTemplate} style={secondaryBtn}>📥 Template</button>
            <label style={importBtn}>📂 Import CSV <input type="file" accept=".csv" onChange={handleImport} style={{display:'none'}} /></label>
            <button onClick={() => setIsStarted(false)} style={cancelBtn}>Adjust Rules</button>
            <button onClick={handleSave} disabled={saving} style={saveActionBtn}>{saving ? 'Saving...' : 'Finalize Run'}</button>
        </div>
      </div>

      {activeHolidays.length > 0 && (
        <div style={holidayAlertBanner}>
            📢 <strong>Calendar Alert:</strong> Found {activeHolidays.length} holiday(s) in this period.
            <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginTop:'5px'}}>{activeHolidays.map(h => (<span key={h.id} style={holidayBadge}>{new Date(h.holiday_date).getDate()} {h.name}</span>))}</div>
        </div>
      )}

      <div style={{ padding: '0 20px 20px 20px' }}>
        <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={searchStyle} />
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '30px' }}>
        {filteredEmployees.map(emp => {
            const inputs = payrollEntries[emp.id];
            if (!inputs || !config) return null; // CRITICAL CRASH PROTECTION
            let v = Number(inputs.loanPayment) || 0;
            if (inputs.loanMode === 'half') v /= 2;
            if (inputs.loanMode === 'none') v = 0;
            const safeL = Math.min(v, Number(inputs.loanBalance) || 0);
            const pay = calculatePayroll(emp, config, orgSettings, { ...inputs, loanPayment: safeL, sssMode: inputs.deductSSS ? deductionModes.sss : 'none', phMode: inputs.deductPH ? deductionModes.ph : 'none', piMode: inputs.deductPI ? deductionModes.pi : 'none' });

            return (
            <div key={emp.id} style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
                <div style={empRow}>
                    <div style={empInfo}>
                        <div style={avatarId}>{emp.employee_id_number}</div>
                        <div style={{ minWidth: '160px' }}>
                            <div style={empName}>{emp.last_name.toUpperCase()}, {emp.first_name}</div>
                            <div style={empSub}>{emp.department}</div>
                            {activeHolidays.length > 0 && (
                                <button onClick={() => handleInputChange(emp.id, 'showHolidayPanel', !inputs.showHolidayPanel)} style={{...holidayToggle, background: inputs.showHolidayPanel ? '#3b82f6' : '#fef3c7', color: inputs.showHolidayPanel ? 'white' : '#92400e'}}>⭐ Premium/Holiday</button>
                            )}
                        </div>
                    </div>

                    <div style={inputContainer}>
                        <div style={inputBox}><label style={smallLabel}>DAYS</label><input type="number" value={inputs.daysWorked} onChange={e => handleInputChange(emp.id, 'daysWorked', e.target.value)} style={prettyInput} /></div>
                        <div style={inputBox}><label style={smallLabel}>OT / ND</label><div style={splitGroup}><input type="number" value={inputs.otHours} onChange={e => handleInputChange(emp.id, 'otHours', e.target.value)} style={splitInput} /><input type="number" value={inputs.ndHours} onChange={e => handleInputChange(emp.id, 'ndHours', e.target.value)} style={splitInput} /></div></div>
                        <div style={inputBox}><label style={smallLabel}>LATE / UT</label><div style={splitGroup}><input type="number" value={inputs.lateMinutes} onChange={e => handleInputChange(emp.id, 'lateMinutes', e.target.value)} style={splitInput} /><input type="number" value={inputs.undertimeMinutes} onChange={e => handleInputChange(emp.id, 'undertimeMinutes', e.target.value)} style={splitInput} /></div></div>

                        <div style={inputBox}>
                          <label style={smallLabel}>VALE</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <input type="text" readOnly value={v.toLocaleString(undefined, {minimumFractionDigits: 2})} style={{...prettyInput, width: '70px', background: '#f8fafc', borderColor: '#fecaca'}} />
                              <button onClick={() => handleInputChange(emp.id, 'loanMode', inputs.loanMode === 'full' ? 'half' : inputs.loanMode === 'half' ? 'none' : 'full')} style={{...valeHelperBtn, background: inputs.loanMode === 'full' ? '#10b981' : inputs.loanMode === 'half' ? '#f59e0b' : '#ef4444'}}>{inputs.loanMode[0].toUpperCase()}</button>
                          </div>
                        </div>

                        {orgSettings?.deduction_labels?.map((label, idx) => !label.startsWith("Deduction") && (
                            <div key={`d-${idx}`} style={inputBox}><label style={smallLabel}>{label.toUpperCase()}</label><input type="number" value={inputs.customDeductions[idx]} onChange={e => handleInputChange(emp.id, 'customDeductions', e.target.value, idx)} style={{ ...prettyInput, borderColor: '#fecaca' }} /></div>
                        ))}
                        {orgSettings?.addition_labels?.map((label, idx) => !label.startsWith("Add Pay") && (
                            <div key={`a-${idx}`} style={inputBox}><label style={smallLabel}>{label.toUpperCase()}</label><input type="number" value={inputs.customAdditions[idx]} onChange={e => handleInputChange(emp.id, 'customAdditions', e.target.value, idx)} style={{ ...prettyInput, borderColor: '#bbf7d0' }} /></div>
                        ))}
                    </div>

                    <div style={netSection}>
                        <div style={smallLabel}>EST. NET PAY</div>
                        <div style={netValue}>₱{pay?.netPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    </div>
                </div>

                {inputs.showHolidayPanel && (
                    <div style={holidayPanel}>
                        <div style={panelField}><label style={panelLabel}>REG HOL</label><input type="number" value={inputs.regHolidayDays} onChange={e => handleInputChange(emp.id, 'regHolidayDays', e.target.value)} style={panelInput} /></div>
                        <div style={panelField}><label style={panelLabel}>SPEC HOL</label><input type="number" value={inputs.specHolidayDays} onChange={e => handleInputChange(emp.id, 'specHolidayDays', e.target.value)} style={panelInput} /></div>
                        <div style={panelField}><label style={panelLabel}>REG OT</label><input type="number" value={inputs.regHolidayOTHrs} onChange={e => handleInputChange(emp.id, 'regHolidayOTHrs', e.target.value)} style={{...panelInput, borderColor: '#f43f5e'}} /></div>
                        <div style={panelField}><label style={panelLabel}>SPEC OT</label><input type="number" value={inputs.specHolidayOTHrs} onChange={e => handleInputChange(emp.id, 'specHolidayOTHrs', e.target.value)} style={{...panelInput, borderColor: '#f43f5e'}} /></div>
                        <div style={panelField}><label style={panelLabel}>REG ND</label><input type="number" value={inputs.regHolidayND} onChange={e => handleInputChange(emp.id, 'regHolidayND', e.target.value)} style={{...panelInput, borderColor: '#8b5cf6'}} /></div>
                        <div style={panelField}><label style={panelLabel}>SPEC ND</label><input type="number" value={inputs.specHolidayND} onChange={e => handleInputChange(emp.id, 'specHolidayND', e.target.value)} style={{...panelInput, borderColor: '#8b5cf6'}} /></div>
                    </div>
                )}
            </div>
            );
        })}
      </div>
    </div>
  );
}

// --- [SECTION 8: STYLES - FULLY RESTORED] ---
const holidayAlertBanner = { background: '#fff7ed', border: '1px solid #ffedd5', padding: '15px 25px', borderRadius: '16px', margin: '0 20px 20px 20px', color: '#9a3412', fontSize: '0.9rem' };
const holidayBadge = { background: '#ffedd5', padding: '3px 10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.75rem' };
const holidayToggle = { marginTop: '8px', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '0.65rem', fontWeight: 'bold', cursor: 'pointer' };
const holidayPanel = { background: '#f8fafc', margin: '-15px 20px 0 20px', padding: '20px 40px', borderRadius: '0 0 24px 24px', border: '1px solid #f1f5f9', display: 'flex', gap: '30px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' };
const panelField = { display: 'flex', flexDirection: 'column', gap: '5px' };
const panelLabel = { fontSize: '0.6rem', fontWeight: 'bold', color: '#64748b' };
const panelInput = { width: '80px', padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' };
const valeHelperBtn = { border: 'none', color: 'white', width: '24px', height: '38px', borderRadius: '8px', cursor: 'pointer', fontWeight: '900', fontSize: '0.7rem' };
const headerBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px', background: '#1e293b', padding: '25px 35px', borderRadius: '24px', color: 'white' };
const searchStyle = { width: '100%', padding: '15px 25px', borderRadius: '16px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem' };
const modeBadge = { fontSize: '0.65rem', background: '#334155', padding: '4px 10px', borderRadius: '6px', color: '#cbd5e1', fontWeight: 'bold' };
const saveActionBtn = { background: '#10b981', color: 'white', padding: '12px 25px', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer' };
const cancelBtn = { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '12px 25px', borderRadius: '14px', cursor: 'pointer' };
const empRow = { background: 'white', padding: '20px 30px', borderRadius: '24px', margin: '0 20px 0 20px', display: 'flex', alignItems: 'center', minWidth: 'max-content', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const empInfo = { display: 'flex', alignItems: 'center', gap: '18px', width: '260px', flexShrink: 0 };
const avatarId = { width: '45px', height: '45px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '0.85rem', border: '1px solid #e2e8f0' };
const empName = { fontWeight: '800', fontSize: '0.95rem', color: '#1e293b' };
const empSub = { fontSize: '0.75rem', color: '#94a3b8' };
const inputContainer = { display: 'flex', gap: '15px', padding: '0 30px', alignItems: 'flex-end' };
const inputBox = { display: 'flex', flexDirection: 'column', gap: '8px' };
const smallLabel = { fontSize: '0.65rem', fontWeight: '900', color: '#cbd5e1', textAlign: 'center' };
const splitGroup = { display: 'flex', gap: '4px', background: '#f8fafc', padding: '4px', borderRadius: '10px' };
const prettyInput = { width: '70px', padding: '10px', border: '2px solid #f1f5f9', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' };
const splitInput = { ...prettyInput, width: '45px', fontSize: '0.8rem', padding: '8px 4px', border: 'none', background: 'white' };
const netSection = { textAlign: 'right', width: '180px', borderLeft: '2px solid #f8fafc', paddingLeft: '30px', flexShrink: 0 };
const netValue = { fontSize: '1.4rem', fontWeight: '900', color: '#059669' };
const setupWrapper = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' };
const setupCard = { background: 'white', padding: '50px', borderRadius: '32px', textAlign: 'center', width: '500px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' };
const setupGrid = { display: 'flex', justifyContent: 'space-between', gap: '40px', marginBottom: '25px', width: '100%' };
const inputGroup = { flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' };
const fieldLabel = { fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.05em' };
const styledDateInput = { width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #f1f5f9', marginTop: '8px', fontSize: '0.9rem', outline: 'none' };
const modeSelectionArea = { display: 'flex', justifyContent: 'space-around', background: '#f8fafc', padding: '25px', borderRadius: '24px', marginBottom: '35px' };
const modeBox = { display: 'flex', flexDirection: 'column', gap: '8px' };
const modeLabel = { fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' };
const modeSelect = { padding: '10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.85rem' };
const startBtn = { width: '100%', padding: '18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '16px', fontWeight: '900', cursor: 'pointer' };
const disabledBtn = { ...startBtn, background: '#e2e8f0', cursor: 'not-allowed' };
const msgBox = { padding: '100px', textAlign: 'center', color: '#64748b', fontSize: '1.1rem' };
const secondaryBtn = { background: '#334155', color: 'white', padding: '12px 20px', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' };
const importBtn = { ...secondaryBtn, background: '#475569' };