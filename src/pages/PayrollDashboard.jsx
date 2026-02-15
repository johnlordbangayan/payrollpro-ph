import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { calculatePayroll } from '../lib/payrollLogic';

export default function PayrollDashboard({ organizationId, orgSettings }) {
  const fileInputRef = useRef(null);
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
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

        const initial = {};
        sortedEmployees.forEach(e => {
          const loanData = loanMap[e.id] || { balance: 0, installment: 0 };
          initial[e.id] = { 
            daysWorked: 0, otHours: 0, ndHours: 0, lateMinutes: 0, undertimeMinutes: 0,
            loanPayment: loanData.installment || 0,
            loanBalance: loanData.balance || 0,
            holidaysWorked: [], 
            customDeductions: [0, 0, 0, 0, 0],
            customAdditions: [0, 0, 0],
            short: 0,
            cashBond: 0
          };
        });
        setPayrollEntries(initial);
      } catch (err) { console.error("Fetch Error:", err); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, [organizationId]);

  const activeAdds = (orgSettings?.addition_labels || []).map((label, index) => ({ label, index })).filter(item => item.label && !item.label.startsWith("Add Pay"));
  const activeDeds = (orgSettings?.deduction_labels || []).map((label, index) => ({ label, index })).filter(item => item.label && !item.label.startsWith("Deduction"));

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

  const handleSave = async () => {
    const encodedEmployees = employees.filter(emp => {
      const entry = payrollEntries[emp.id];
      return entry && parseFloat(entry.daysWorked) > 0;
    });

    if (encodedEmployees.length === 0) {
      alert("No data detected. Please enter 'Days Worked' for at least one employee.");
      return;
    }

    if (!window.confirm(`Finalize payroll for ${encodedEmployees.length} employee(s)?`)) return;
    
    setSaving(true);

    try {
      const r = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

      const payload = encodedEmployees.map(emp => {
        const inputs = payrollEntries[emp.id];
        const safeBalance = parseFloat(inputs.loanBalance) || 0;
        const safePayment = parseFloat(inputs.loanPayment) || 0;
        const safeLoanDeduction = Math.min(safePayment, safeBalance);
        
        const pay = calculatePayroll(emp, config, orgSettings, { 
          ...inputs, 
          loanPayment: safeLoanDeduction,
          sssMode: deductionModes.sss, 
          phMode: deductionModes.ph, 
          piMode: deductionModes.pi 
        });

        return {
          organization_id: organizationId,
          employee_id: emp.id,
          period_start: period.start,
          period_end: period.end,
          days_worked: r(inputs.daysWorked),
          ot_hours: r(inputs.otHours),
          nd_hours: r(inputs.ndHours),
          late_minutes: parseInt(inputs.lateMinutes) || 0,
          undertime_minutes: parseInt(inputs.undertimeMinutes) || 0,
          basic_pay: r(pay.basicPay),
          ot_pay: r(pay.otPay),
          nd_pay: r(pay.ndPay),
          holiday_pay: r(pay.holidayPay),
          time_deduction: r(pay.timeDeduction),
          gross_pay: r(pay.grossPay),
          sss_deduction: r(pay.sssEE),
          philhealth_deduction: r(pay.phEE),
          pagibig_deduction: r(pay.piEE),
          tax_deduction: r(pay.taxWH),
          loan_deduction: r(safeLoanDeduction),
          net_pay: r(pay.netPay),
          department: emp.department || 'Unassigned',
          custom_deductions: Array.isArray(inputs.customDeductions) 
            ? inputs.customDeductions.map(v => r(v)) 
            : [0, 0, 0, 0, 0],
          custom_additions: Array.isArray(inputs.customAdditions) 
            ? inputs.customAdditions.map(v => r(v)) 
            : [0, 0, 0]
        };
      });

      // 1. SAVE PAYROLL HISTORY
      const { error: historyError } = await supabase.from('payroll_history').insert(payload);
      if (historyError) throw historyError;

      // 2. DIRECT LOAN UPDATE (Replaces the hanging RPC)
      const loanUpdates = payload.filter(p => p.loan_deduction > 0);
      
      if (loanUpdates.length > 0) {
        for (const record of loanUpdates) {
          // Fetch current balance to ensure no negative values
          const { data: currentLoan } = await supabase
            .from('loans')
            .select('balance')
            .eq('employee_id', record.employee_id)
            .eq('is_active', true)
            .single();

          if (currentLoan) {
            const newBalance = Math.max(0, r(currentLoan.balance - record.loan_deduction));
            
            const { error: updateError } = await supabase
                .from('loans')
                .update({ 
                    balance: newBalance,
                    is_active: newBalance > 0 
                })
                .eq('employee_id', record.employee_id)
                .eq('is_active', true);

            if (updateError) console.error("Loan update failed for:", record.employee_id, updateError);
          }
        }
      }

      alert("Payroll run saved and Loan Ledger updated!");
      setIsStarted(false); 
      
    } catch (err) { 
      console.error("Critical Save Error:", err);
      alert("Save Failed: " + (err.message || "Unknown Error")); 
    } finally {
      setSaving(false);
    }
  };

  // --- RENDERING ---
  const filteredEmployees = employees.filter(emp => 
    `${emp.first_name} ${emp.last_name} ${emp.department}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div style={msgBox}>Loading System...</div>;

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
        <div>
            <h3 style={{ margin: 0 }}>Run: {period.start} — {period.end}</h3>
            <div style={{display:'flex', gap:'10px', marginTop:'8px'}}>
               <span style={modeBadge}>SSS: {deductionModes.sss.toUpperCase()}</span>
               <span style={modeBadge}>PHIC: {deductionModes.ph.toUpperCase()}</span>
               <span style={modeBadge}>HDMF: {deductionModes.pi.toUpperCase()}</span>
            </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setIsStarted(false)} style={cancelBtn}>Adjust Rules</button>
            <button onClick={handleSave} disabled={saving} style={saveActionBtn}>{saving ? 'Saving...' : 'Finalize Run'}</button>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px 20px' }}>
        <input type="text" placeholder="🔍 Search employee name or department..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={searchStyle} />
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '30px' }}>
        {filteredEmployees.map(emp => {
            const inputs = payrollEntries[emp.id];
            const safeLoanPayment = Math.min(Number(inputs.loanPayment) || 0, Number(inputs.loanBalance) || 0);
            const pay = calculatePayroll(emp, config, orgSettings, { ...inputs, loanPayment: safeLoanPayment, sssMode: deductionModes.sss, phMode: deductionModes.ph, piMode: deductionModes.pi });
            return (
            <div key={emp.id} style={empRow}>
                <div style={empInfo}>
                    <div style={avatar}>{emp.last_name[0]}{emp.first_name[0]}</div>
                    <div style={{ minWidth: '160px' }}>
                        <div style={empName}>{emp.last_name.toUpperCase()}, {emp.first_name}</div>
                        <div style={empSub}>{emp.department} • ₱{Number(emp.salary_rate).toLocaleString()}</div>
                    </div>
                </div>

                <div style={inputContainer}>
                    <div style={inputBox}><label style={smallLabel}>DAYS</label><input type="number" value={inputs.daysWorked} onChange={e => handleInputChange(emp.id, 'daysWorked', e.target.value)} style={prettyInput} /></div>
                    
                    <div style={inputBox}>
                        <label style={smallLabel}>OT / ND (H)</label>
                        <div style={splitGroup}>
                            <input type="number" placeholder="OT" value={inputs.otHours} onChange={e => handleInputChange(emp.id, 'otHours', e.target.value)} style={splitInput} />
                            <input type="number" placeholder="ND" value={inputs.ndHours} onChange={e => handleInputChange(emp.id, 'ndHours', e.target.value)} style={splitInput} />
                        </div>
                    </div>

                    <div style={inputBox}>
                        <label style={smallLabel}>LATE / UT (M)</label>
                        <div style={splitGroup}>
                            <input type="number" placeholder="L" value={inputs.lateMinutes} onChange={e => handleInputChange(emp.id, 'lateMinutes', e.target.value)} style={splitInput} />
                            <input type="number" placeholder="UT" value={inputs.undertimeMinutes} onChange={e => handleInputChange(emp.id, 'undertimeMinutes', e.target.value)} style={splitInput} />
                        </div>
                    </div>

                    <div style={inputBox}>
                        <label style={smallLabel}>VALE</label>
                        <input type="number" value={inputs.loanPayment} onChange={e => handleInputChange(emp.id, 'loanPayment', e.target.value)} style={{...prettyInput, borderColor: '#fecaca'}} />
                        {inputs.loanBalance > 0 && <span style={balanceBadge}>Bal: ₱{inputs.loanBalance.toLocaleString()}</span>}
                    </div>

                    <div style={inputBox}><label style={smallLabel}>SHORT</label><input type="number" value={inputs.short} onChange={e => handleInputChange(emp.id, 'short', e.target.value)} style={{...prettyInput, borderColor: '#fecaca'}} /></div>
                    <div style={inputBox}><label style={smallLabel}>CASH BOND</label><input type="number" value={inputs.cashBond} onChange={e => handleInputChange(emp.id, 'cashBond', e.target.value)} style={{...prettyInput, borderColor: '#fecaca'}} /></div>
                </div>

                <div style={netSection}>
                    <div style={smallLabel}>EST. NET PAY</div>
                    <div style={netValue}>₱{pay?.netPay.toLocaleString(undefined, {minimumFractionDigits: 3})}</div>
                </div>
            </div>
            );
        })}
      </div>
    </div>
  );
}

// --- STYLES ---
const balanceBadge = { fontSize: '0.6rem', color: '#ef4444', fontWeight: 'bold', marginTop: '2px', textAlign: 'center' };
const msgBox = { padding: '100px', textAlign: 'center', color: '#64748b', fontSize: '1.1rem' };
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
const headerBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px', background: '#1e293b', padding: '25px 35px', borderRadius: '24px', color: 'white' };
const searchStyle = { width: '100%', padding: '15px 25px', borderRadius: '16px', border: '2px solid #f1f5f9', outline: 'none', fontSize: '1rem' };
const modeBadge = { fontSize: '0.65rem', background: '#334155', padding: '4px 10px', borderRadius: '6px', color: '#cbd5e1', fontWeight: 'bold' };
const saveActionBtn = { background: '#10b981', color: 'white', padding: '12px 25px', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer' };
const cancelBtn = { background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '12px 25px', borderRadius: '14px', cursor: 'pointer' };
const empRow = { background: 'white', padding: '20px 30px', borderRadius: '24px', margin: '0 20px 12px 20px', display: 'flex', alignItems: 'center', minWidth: 'max-content', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const empInfo = { display: 'flex', alignItems: 'center', gap: '18px', width: '260px', flexShrink: 0 };
const avatar = { width: '45px', height: '45px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' };
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