import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Payroll() {
  // --- STATE VARIABLES ---
  const [employees, setEmployees] = useState([]);
  const [payrollHistory, setPayrollHistory] = useState([]); 
  const [selectedEmp, setSelectedEmp] = useState('');
  
  const [rateType, setRateType] = useState('hourly'); // 'hourly', 'daily', 'monthly'
  const [inputValue, setInputValue] = useState(0); 
  const [dates, setDates] = useState({ start: '', end: '' });
  const [calculations, setCalculations] = useState({ rateUsed: 0, gross: 0, deductions: 0, net: 0 });
  const [loading, setLoading] = useState(false);

  // --- 1. INITIAL LOAD ---
  useEffect(() => {
    fetchEmployees();
    fetchHistory();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase.from('employees').select('*').eq('employment_status', 'Active').order('last_name');
    setEmployees(data || []);
  };

  // This is the function that was missing!
  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('payroll_records')
      .select(`*, employees (first_name, last_name)`)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (!error) setPayrollHistory(data);
  };

  // --- 2. THE SMART CALCULATOR (313 Factor + Fallbacks) ---
  useEffect(() => {
    if (!selectedEmp) return;

    const employee = employees.find(e => e.id === selectedEmp);
    if (employee) {
      let finalRate = 0;
      let grossPay = 0;

      // Get DB Values (Default to 0)
      const dbMonthly = employee.monthly_salary || 0;
      const dbDaily = employee.daily_rate || 0;
      const dbHourly = employee.hourly_rate || 0;

      // Calculate Derived Rates
      const calcDaily = dbDaily || (dbMonthly > 0 ? (dbMonthly * 12) / 313 : 0) || (dbHourly * 8);
      const calcMonthly = dbMonthly || (calcDaily * 313) / 12;
      const calcHourly = dbHourly || (calcDaily / 8);

      // Apply Logic
      if (rateType === 'hourly') {
        finalRate = calcHourly;
        grossPay = inputValue * finalRate;
      } 
      else if (rateType === 'daily') {
        finalRate = calcDaily;
        grossPay = inputValue * finalRate;
      } 
      else if (rateType === 'monthly') {
        finalRate = calcMonthly;
        grossPay = inputValue * finalRate; 
      }

      const deductions = grossPay * 0.10; // Est. 10%
      
      setCalculations({
        rateUsed: finalRate,
        gross: grossPay,
        deductions: deductions,
        net: grossPay - deductions
      });
    }
  }, [inputValue, selectedEmp, rateType, employees]);

  // --- 3. THE BULLETPROOF SAVE ---
  const handleSave = async () => {
    if (!selectedEmp || !dates.start || !dates.end) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      // Get Organization ID
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('organization_id')
        .eq('id', selectedEmp)
        .single();

      if (empError) throw new Error("Employee org not found");

      // Insert Record
      const { error: saveError } = await supabase.from('payroll_records').insert([
        {
          organization_id: empData.organization_id,
          employee_id: selectedEmp,
          pay_period_start: dates.start,
          pay_period_end: dates.end,
          
          total_hours: rateType === 'hourly' ? inputValue : 0,
          total_days: rateType === 'daily' ? inputValue : 0,
          total_months: rateType === 'monthly' ? inputValue : 0,
          
          gross_pay: calculations.gross,
          other_deductions: calculations.deductions,
          net_pay: calculations.net,
          status: 'Draft'
        }
      ]);

      if (saveError) throw saveError;

      alert("Payroll Saved Successfully!");
      setInputValue(0); 
      await fetchHistory(); // Now this will work!

    } catch (error) {
      console.error("Save Error:", error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false); 
    }
  };

  // --- 4. THE UI ---
  return (
    <div style={{ padding: '20px', color: '#0f172a', maxWidth: '1000px' }}>
      <h2 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>💰 Payroll Calculator (313 Factor)</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '20px', marginBottom: '40px' }}>
        
        {/* INPUTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <label>
            <strong>1. Select Employee:</strong>
            <select style={{ width: '100%', padding: '10px', marginTop: '5px' }} value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
              <option value="">-- Choose Staff --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.last_name}, {emp.first_name}</option>
              ))}
            </select>
          </label>

          <label>
            <strong>2. Choose Rate Basis:</strong>
            <select style={{ width: '100%', padding: '10px', marginTop: '5px', backgroundColor: '#eef2ff' }} value={rateType} onChange={(e) => { setRateType(e.target.value); setInputValue(0); }}>
              <option value="hourly">Hourly Rate</option>
              <option value="daily">Daily Rate</option>
              <option value="monthly">Monthly Rate</option>
            </select>
          </label>

          <label>
            <strong>3. Enter {rateType === 'hourly' ? 'Hours' : rateType === 'daily' ? 'Days' : 'Months (e.g. 0.5)'}:</strong>
            <input type="number" step="0.01" style={{ width: '100%', padding: '10px', fontSize: '1.2rem' }} value={inputValue} onChange={(e) => setInputValue(parseFloat(e.target.value) || 0)} />
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="date" style={{ flex: 1, padding: '10px' }} onChange={e => setDates({...dates, start: e.target.value})} />
            <input type="date" style={{ flex: 1, padding: '10px' }} onChange={e => setDates({...dates, end: e.target.value})} />
          </div>

          <button onClick={handleSave} disabled={loading} style={{ padding: '15px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '5px', fontSize: '1rem', cursor: 'pointer' }}>
            {loading ? 'Processing...' : '✅ Save Payroll Record'}
          </button>
        </div>

        {/* PREVIEW */}
        <div style={{ backgroundColor: '#f8fafc', padding: '25px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
          <h3 style={{ marginTop: 0 }}>Payslip Preview</h3>
          <hr />
          <div style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#64748b' }}>
            <div><strong>Calculation Basis:</strong> {rateType.toUpperCase()}</div>
            <div><strong>Applied Rate:</strong> ₱{calculations.rateUsed.toFixed(2)}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Basic Pay:</span><strong>₱{calculations.gross.toFixed(2)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
            <span>Less Deductions (Est. 10%):</span><strong>- ₱{calculations.deductions.toFixed(2)}</strong>
          </div>
          <hr />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.8rem', color: '#16a34a' }}>
            <span>Net Pay:</span><strong>₱{calculations.net.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <h3 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>📜 Recent Payroll History</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: '10px' }}>Date</th>
            <th style={{ padding: '10px' }}>Employee</th>
            <th style={{ padding: '10px' }}>Net Pay</th>
            <th style={{ padding: '10px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {payrollHistory.length === 0 ? (
            <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>No records yet.</td></tr>
          ) : (
            payrollHistory.map((record) => (
              <tr key={record.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px' }}>{new Date(record.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '10px' }}>{record.employees?.last_name}, {record.employees?.first_name}</td>
                <td style={{ padding: '10px', color: '#16a34a', fontWeight: 'bold' }}>₱{record.net_pay.toFixed(2)}</td>
                <td style={{ padding: '10px' }}><span style={{ backgroundColor: '#e2e8f0', padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{record.status}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}