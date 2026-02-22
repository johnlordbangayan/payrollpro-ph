import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generatePayslipPDF, generateBulkPayslips } from '../lib/pdfGenerator';
import { calculatePayroll } from '../lib/payrollLogic';

export default function PayrollHistory({ organizationId }) {
  // --- [STATE: DATA STORAGE] ---
  const [records, setRecords] = useState([]);
  const [orgData, setOrgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState({ start: '', end: '' });

  // --- [STATE: EDITING & MODALS] ---
  const [editingRecord, setEditingRecord] = useState(null);
  const [employeeMap, setEmployeeMap] = useState({});
  const [globalConfig, setGlobalConfig] = useState({});
  const [previewPay, setPreviewPay] = useState(null); 

  // --- [INITIALIZATION] ---
  useEffect(() => {
    const initializeHistory = async () => {
      setLoading(true);
      try {
        const [orgRes, latestRes, empRes, confRes] = await Promise.all([
          supabase.from('organizations').select('*').eq('id', organizationId).single(),
          supabase.from('payroll_history')
            .select('period_start, period_end')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(1),
          supabase.from('employees').select('*').eq('organization_id', organizationId),
          supabase.from('payroll_config').select('*')
        ]);

        setOrgData(orgRes.data);
        const empMap = (empRes.data || []).reduce((acc, emp) => ({ ...acc, [emp.id]: emp }), {});
        setEmployeeMap(empMap);

        const confObj = (confRes.data || []).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
        setGlobalConfig(confObj);

        let start = filterPeriod.start;
        let end = filterPeriod.end;

        if (!start && latestRes.data?.[0]) {
          start = latestRes.data[0].period_start;
          end = latestRes.data[0].period_end;
          setFilterPeriod({ start, end });
        }

        fetchHistory(start, end);
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeHistory();
  }, [organizationId]);

  // --- [FETCH LOGIC: SORT BY DEPARTMENT THEN NAME] ---
  const fetchHistory = async (start, end) => {
    let query = supabase.from('payroll_history').select(`*, employees(*)`);
    query = query.eq('organization_id', organizationId);
    if (start && end) {
      query = query.gte('period_start', start).lte('period_end', end);
    }
    const { data } = await query;
    
    if (data) {
      const sorted = [...data].sort((a, b) => {
        // 1. Sort by Department (Handling nulls/unassigned)
        const deptA = (a.employees?.department || "ZZZ-Unassigned").toUpperCase();
        const deptB = (b.employees?.department || "ZZZ-Unassigned").toUpperCase();
        if (deptA < deptB) return -1;
        if (deptA > deptB) return 1;

        // 2. Sort by Last Name within same department
        const nameA = (a.employees?.last_name || "").toUpperCase();
        const nameB = (b.employees?.last_name || "").toUpperCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        
        return (a.employees?.first_name || "").localeCompare(b.employees?.first_name || "");
      });
      setRecords(sorted);
    }
  };

  const handleSearch = () => fetchHistory(filterPeriod.start, filterPeriod.end);

  const handleBulkPrint = () => {
    if (records.length === 0) return alert("No records to print.");
    // The records array is already sorted by department, so the PDF will follow this order.
    generateBulkPayslips(orgData, records);
  };

  const handleDelete = async (recordId, employeeName) => {
    if (!window.confirm(`Delete record for ${employeeName}?`)) return;
    try {
      const { error } = await supabase.from('payroll_history').delete().eq('id', recordId);
      if (error) throw error;
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  // --- [EDIT HANDLERS] ---
  const handleEditClick = (record) => {
    const initialInputs = {
      daysWorked: record.days_worked || 0,
      otHours: record.ot_hours || 0,
      ndHours: record.nd_hours || 0,
      lateMinutes: record.late_minutes || 0,
      undertimeMinutes: record.undertime_minutes || 0,
      regHolidayDays: record.reg_holiday_days || 0,
      regHolidayOTHrs: record.reg_holiday_ot_hrs || 0,
      regHolidayND: record.reg_holiday_nd || 0,
      specHolidayDays: record.spec_holiday_days || 0,
      specHolidayOTHrs: record.spec_holiday_ot_hrs || 0,
      specHolidayND: record.spec_holiday_nd || 0,
      restDayHrs: record.rest_day_hours || 0,
      sssMode: record.sss_deduction > 0 ? 'full' : 'none',
      phMode: record.philhealth_deduction > 0 ? 'full' : 'none',
      piMode: record.pagibig_deduction > 0 ? 'full' : 'none',
      loanPayment: record.loan_deduction || 0,
      customDeductions: record.custom_deductions || [0, 0, 0, 0, 0],
      customAdditions: record.custom_additions || [0, 0, 0]
    };

    setEditingRecord({ ...record, inputs: initialInputs });
    recalculatePreview(record.employee_id, initialInputs);
  };

  const handleModalChange = (field, value, index = null) => {
    setEditingRecord(prev => {
      let updatedInputs;
      if (index !== null) {
        const newList = [...prev.inputs[field]];
        newList[index] = parseFloat(value) || 0;
        updatedInputs = { ...prev.inputs, [field]: newList };
      } else {
        updatedInputs = { ...prev.inputs, [field]: value };
      }
      recalculatePreview(prev.employee_id, updatedInputs);
      return { ...prev, inputs: updatedInputs };
    });
  };

  const recalculatePreview = (empId, inputs) => {
    const emp = employeeMap[empId];
    if (!emp) return;
    const pay = calculatePayroll(emp, globalConfig, orgData, inputs);
    setPreviewPay(pay);
  };

  const saveEdit = async () => {
    if (!window.confirm("Save changes to this record?")) return;
    const rec = editingRecord;
    const r = (num) => Math.round((parseFloat(num) || 0) * 100) / 100;

    const updates = {
      days_worked: r(rec.inputs.daysWorked),
      ot_hours: r(rec.inputs.otHours),
      nd_hours: r(rec.inputs.ndHours),
      late_minutes: parseInt(rec.inputs.lateMinutes) || 0,
      undertime_minutes: parseInt(rec.inputs.undertimeMinutes) || 0,
      reg_holiday_days: r(rec.inputs.regHolidayDays),
      reg_holiday_ot_hrs: r(rec.inputs.regHolidayOTHrs),
      reg_holiday_nd: r(rec.inputs.regHolidayND),
      spec_holiday_days: r(rec.inputs.specHolidayDays),
      spec_holiday_ot_hrs: r(rec.inputs.specHolidayOTHrs),
      spec_holiday_nd: r(rec.inputs.specHolidayND),
      rest_day_hours: r(rec.inputs.restDayHrs),
      custom_deductions: rec.inputs.custom_deductions.map(v => r(v)),
      custom_additions: rec.inputs.custom_additions.map(v => r(v)),
      basic_pay: r(previewPay.basicPay),
      ot_pay: r(previewPay.otPay),
      nd_pay: r(previewPay.ndPay),
      holiday_pay: r(previewPay.holidayPay),
      gross_pay: r(previewPay.grossPay),
      sss_deduction: r(previewPay.sssEE),
      philhealth_deduction: r(previewPay.phEE),
      pagibig_deduction: r(previewPay.piEE),
      tax_deduction: r(previewPay.taxWH),
      net_pay: r(previewPay.netPay),
    };

    try {
      const { error } = await supabase.from('payroll_history').update(updates).eq('id', rec.id);
      if (error) throw error;
      setRecords(prev => prev.map(r => r.id === rec.id ? { ...r, ...updates } : r));
      setEditingRecord(null);
      alert("Record updated successfully.");
    } catch (err) {
      alert("Update failed: " + err.message);
    }
  };

  if (loading) return <div style={msgBox}>Loading Archive...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: 'auto', padding: '20px' }}>
      {/* FILTER BAR */}
      <div style={filterBar}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#475569' }}>BATCH FILTER:</span>
            <input type="date" value={filterPeriod.start} onChange={e => setFilterPeriod({...filterPeriod, start: e.target.value})} style={dateInput} />
            <input type="date" value={filterPeriod.end} onChange={e => setFilterPeriod({...filterPeriod, end: e.target.value})} style={dateInput} />
            <button onClick={handleSearch} style={searchBtn}>Search</button>
          </div>
          <button onClick={handleBulkPrint} disabled={records.length === 0} style={bulkBtn}>
            🖨️ Bulk Payslips ({records.length})
          </button>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div style={tableCard}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={theadStyle}>
              <th style={th}>Period</th>
              <th style={th}>Employee</th>
              <th style={th}>Dept</th>
              <th style={th}>Net Pay</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, idx) => {
              // Grouping UI Logic
              const currentDept = r.employees?.department || "Unassigned";
              const prevDept = idx > 0 ? records[idx - 1].employees?.department : null;
              const isNewDept = currentDept !== prevDept;

              return (
                <React.Fragment key={r.id}>
                  {isNewDept && (
                    <tr style={{ background: '#f1f5f9' }}>
                      <td colSpan="5" style={{ padding: '8px 15px', fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b' }}>
                        📁 {currentDept.toUpperCase()}
                      </td>
                    </tr>
                  )}
                  <tr style={trStyle}>
                    <td style={td}>{r.period_start} to {r.period_end}</td>
                    <td style={td}><strong>{r.employees?.last_name?.toUpperCase()}, {r.employees?.first_name}</strong></td>
                    <td style={{...td, color: '#94a3b8', fontSize: '0.8rem'}}>{r.employees?.department || '---'}</td>
                    <td style={{ ...td, color: '#16a34a', fontWeight: 'bold' }}>₱{Number(r.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style={{ ...td, textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleEditClick(r)} style={editBtn}>✏️</button>
                      <button onClick={() => generatePayslipPDF(orgData, r)} style={viewBtn}>PDF</button>
                      <button onClick={() => handleDelete(r.id, `${r.employees?.first_name} ${r.employees?.last_name}`)} style={deleteBtn}>Del</button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* EDIT MODAL */}
      {editingRecord && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '10px' }}>
                <h3 style={{marginTop:0, color: '#1e293b'}}>Edit Record: {employeeMap[editingRecord.employee_id]?.last_name}</h3>
                
                <div style={modeGrid}>
                {['sssMode', 'phMode', 'piMode'].map(mode => (
                    <div key={mode} style={fieldBox}>
                    <label>{mode.replace('Mode', '').toUpperCase()}</label>
                    <select value={editingRecord.inputs[mode]} onChange={e => handleModalChange(mode, e.target.value)} style={select}>
                        <option value="full">Full</option><option value="half">Half</option><option value="none">None</option>
                    </select>
                    </div>
                ))}
                </div>

                <h4 style={sectionTitle}>Regular Attendance</h4>
                <div style={formGrid}>
                  <div style={fieldBox}><label>Days Worked</label><input type="number" value={editingRecord.inputs.daysWorked} onChange={e => handleModalChange('daysWorked', e.target.value)} style={input} /></div>
                  <div style={fieldBox}><label>Regular OT (H)</label><input type="number" value={editingRecord.inputs.otHours} onChange={e => handleModalChange('otHours', e.target.value)} style={input} /></div>
                  <div style={fieldBox}><label>Regular ND (H)</label><input type="number" value={editingRecord.inputs.ndHours} onChange={e => handleModalChange('ndHours', e.target.value)} style={input} /></div>
                  <div style={fieldBox}><label>Late (Mins)</label><input type="number" value={editingRecord.inputs.lateMinutes} onChange={e => handleModalChange('lateMinutes', e.target.value)} style={input} /></div>
                  <div style={fieldBox}><label>Undertime (M)</label><input type="number" value={editingRecord.inputs.undertimeMinutes} onChange={e => handleModalChange('undertimeMinutes', e.target.value)} style={input} /></div>
                  <div style={fieldBox}><label>Rest Day (H)</label><input type="number" value={editingRecord.inputs.restDayHrs} onChange={e => handleModalChange('restDayHrs', e.target.value)} style={input} /></div>
                </div>

                <h4 style={sectionTitle}>Holiday Pay Premiums</h4>
                <div style={formGrid}>
                    <div style={fieldBox}><label>Reg Hol (Days)</label><input type="number" step="0.1" value={editingRecord.inputs.regHolidayDays} onChange={e => handleModalChange('regHolidayDays', e.target.value)} style={input} /></div>
                    <div style={fieldBox}><label>Spec Hol (Days)</label><input type="number" step="0.1" value={editingRecord.inputs.specHolidayDays} onChange={e => handleModalChange('specHolidayDays', e.target.value)} style={input} /></div>
                    <div style={fieldBox}><label style={{color: '#f43f5e'}}>Reg Hol OT (H)</label><input type="number" value={editingRecord.inputs.regHolidayOTHrs} onChange={e => handleModalChange('regHolidayOTHrs', e.target.value)} style={{...input, borderColor: '#f43f5e'}} /></div>
                    <div style={fieldBox}><label style={{color: '#f43f5e'}}>Spec Hol OT (H)</label><input type="number" value={editingRecord.inputs.specHolidayOTHrs} onChange={e => handleModalChange('specHolidayOTHrs', e.target.value)} style={{...input, borderColor: '#f43f5e'}} /></div>
                    <div style={fieldBox}><label style={{color: '#8b5cf6'}}>Reg Hol ND (H)</label><input type="number" value={editingRecord.inputs.regHolidayND} onChange={e => handleModalChange('regHolidayND', e.target.value)} style={{...input, borderColor: '#8b5cf6'}} /></div>
                    <div style={fieldBox}><label style={{color: '#8b5cf6'}}>Spec Hol ND (H)</label><input type="number" value={editingRecord.inputs.specHolidayND} onChange={e => handleModalChange('specHolidayND', e.target.value)} style={{...input, borderColor: '#8b5cf6'}} /></div>
                </div>

                <h4 style={sectionTitle}>Financial Adjustments</h4>
                <div style={formGrid}>
                    <div style={fieldBox}>
                        <label>Vale (Read Only)</label>
                        <div style={readOnlyDisplay}>₱{Number(editingRecord.inputs.loanPayment).toLocaleString()}</div>
                    </div>

                    {orgData?.deduction_labels?.map((label, idx) => {
                        if (label.startsWith("Deduction")) return null;
                        return (
                            <div key={`ded-${idx}`} style={fieldBox}>
                                <label>{label}</label>
                                <input type="number" value={editingRecord.inputs.customDeductions[idx]} onChange={e => handleModalChange('customDeductions', e.target.value, idx)} style={input} />
                            </div>
                        );
                    })}

                    {orgData?.addition_labels?.map((label, idx) => {
                        if (label.startsWith("Add Pay")) return null;
                        return (
                            <div key={`add-${idx}`} style={fieldBox}>
                                <label>{label}</label>
                                <input type="number" value={editingRecord.inputs.customAdditions[idx]} onChange={e => handleModalChange('customAdditions', e.target.value, idx)} style={input} />
                            </div>
                        );
                    })}
                </div>

                {previewPay && (
                <div style={previewBox}>
                    <div style={{fontSize:'1.1rem', fontWeight:'bold', color:'#059669'}}>Estimated Net Pay: ₱{previewPay.netPay.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                </div>
                )}

                <div style={actionRow}>
                  <button onClick={() => setEditingRecord(null)} style={cancelModalBtn}>Cancel</button>
                  <button onClick={saveEdit} style={saveModalBtn}>Update History Record</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- [SECTION: STYLES] ---
const msgBox = { padding: '50px', textAlign: 'center', color: '#64748b' };
const filterBar = { background: 'white', padding: '20px', borderRadius: '15px', marginBottom: '20px', border: '1px solid #f1f5f9' };
const dateInput = { padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' };
const searchBtn = { padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const bulkBtn = { padding: '8px 16px', background: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const tableCard = { background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' };
const theadStyle = { background: '#f8fafc', textAlign: 'left' };
const th = { padding: '15px', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' };
const td = { padding: '15px', fontSize: '0.9rem' };
const trStyle = { borderBottom: '1px solid #f1f5f9' };
const editBtn = { padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const viewBtn = { padding: '6px 12px', background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const deleteBtn = { padding: '6px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const modalOverlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent = { background: 'white', padding: '30px', borderRadius: '16px', width: '620px' };
const modeGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' };
const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' };
const sectionTitle = { fontSize: '0.8rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '5px', marginTop: '20px', fontWeight: 'bold' };
const fieldBox = { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.8rem', fontWeight: 'bold' };
const input = { padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1' };
const readOnlyDisplay = { padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' };
const select = { ...input, background: 'white' };
const previewBox = { marginTop: '15px', padding: '15px', background: '#f0fdf4', borderRadius: '8px', textAlign: 'right', border: '1px solid #dcfce7' };
const actionRow = { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' };
const cancelModalBtn = { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' };
const saveModalBtn = { background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' };