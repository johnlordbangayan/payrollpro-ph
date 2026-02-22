import { Buffer } from 'buffer';
window.Buffer = Buffer; 

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver'; 

export default function BIR2316Excel({ organizationId, orgSettings }) {
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');

  // --- 1. LOAD EMPLOYEES (DEBUGGED) ---
  useEffect(() => {
    if (!organizationId) {
      console.warn("⚠️ No Organization ID passed to BIR2316Excel");
      return;
    }

    const fetchEmployees = async () => {
      console.log("🔄 Fetching employees for Org:", organizationId);
      
      // We use select('*') to avoid errors if a specific column (like zip_code) is missing
      const { data, error } = await supabase
        .from('employees')
        .select('*') 
        .eq('organization_id', organizationId)
        .order('last_name');
      
      if (error) {
        console.error("❌ Error fetching employees:", error);
        alert("Error loading employees: " + error.message);
      } else {
        console.log("✅ Employees loaded:", data.length);
        setEmployees(data);
      }
    };
    
    fetchEmployees();
  }, [organizationId]);

  // --- 2. GENERATE EXCEL ---
  const generateExcel = async () => {
    if (!selectedEmpId) return alert("Please select an employee.");
    setLoading(true);

    try {
      // A. Fetch Payroll Data
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      const { data: payrolls, error } = await supabase
        .from('payroll_history')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('employee_id', selectedEmpId)
        .gte('period_end', startDate)
        .lte('period_end', endDate);

      if (error) throw error;

      // B. Compute Totals
      let totalBasic = 0, totalHoliday = 0, totalOT = 0, totalND = 0;
      let totalSSS = 0, totalPHIC = 0, totalHDMF = 0, totalTax = 0;

      payrolls.forEach(row => {
        totalBasic += Number(row.basic_pay) || 0;
        totalHoliday += Number(row.holiday_pay) || 0;
        totalOT += Number(row.ot_pay) || 0;
        totalND += Number(row.nd_pay) || 0;
        totalSSS += Number(row.sss_deduction) || 0;
        totalPHIC += Number(row.philhealth_deduction) || 0;
        totalHDMF += Number(row.pagibig_deduction) || 0;
        totalTax += Number(row.tax_deduction) || 0;
      });

      // 13th Month Logic
      const annual13th = totalBasic / 12;
      let nonTaxable13th = annual13th > 90000 ? 90000 : annual13th;
      let taxable13th = annual13th > 90000 ? (annual13th - 90000) : 0;

      // Classify Taxable vs Exempt (250k Rule)
      let basicExempt = 0, basicTaxable = 0;
      if (totalBasic <= 250000) {
        basicExempt = totalBasic;
      } else {
        basicTaxable = totalBasic;
      }

      const totalContribs = totalSSS + totalPHIC + totalHDMF;
      const totalNonTaxable = basicExempt + totalHoliday + totalOT + totalND + nonTaxable13th + totalContribs;
      const totalTaxable = basicTaxable + taxable13th;

      // --- C. LOAD EXCEL TEMPLATE ---
      const response = await fetch('/forms/BIR_2316_Template.xlsx');
      
      if (!response.ok) {
        throw new Error("Could not find the template file. Please check /public/forms/BIR_2316_Template.xlsx");
      }

      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const worksheet = workbook.getWorksheet(1); 

      // --- D. MAP DATA TO CELLS ---
      const emp = employees.find(e => e.id === selectedEmpId);
      
      // Employee Info (Safe checks for missing fields)
      worksheet.getCell('B12').value = emp.tin || '';     
      worksheet.getCell('B14').value = emp.last_name || '';     
      worksheet.getCell('I14').value = emp.first_name || '';    
      worksheet.getCell('L14').value = emp.middle_name || '';   
      worksheet.getCell('B17').value = emp.address || ''; 
      worksheet.getCell('K17').value = emp.zip_code || '';

      // Employer Info
      worksheet.getCell('B24').value = orgSettings?.tin || '';  
      worksheet.getCell('B26').value = orgSettings?.name || ''; 

      // Non-Taxable
      worksheet.getCell('I32').value = basicExempt;      // Line 29
      worksheet.getCell('I33').value = totalHoliday;     // Line 30
      worksheet.getCell('I34').value = totalOT;          // Line 31
      worksheet.getCell('I35').value = totalND;          // Line 32
      worksheet.getCell('I37').value = nonTaxable13th;   // Line 34
      worksheet.getCell('I39').value = totalContribs;    // Line 36
      worksheet.getCell('I41').value = totalNonTaxable;  // Line 38

      // Taxable
      worksheet.getCell('I42').value = basicTaxable;     // Line 39
      worksheet.getCell('I43').value = taxable13th;      // Line 40
      worksheet.getCell('I53').value = totalTaxable;     // Line 50

      // Summary
      worksheet.getCell('I54').value = totalTax;         // Line 51
      worksheet.getCell('I55').value = totalTax;         // Line 52

      // --- E. DOWNLOAD ---
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `2316_${emp.last_name}_${year}.xlsx`);

    } catch (err) {
      console.error(err);
      alert("Error generating Excel: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <h2 style={{marginTop:0, color:'#1e293b'}}>📄 BIR 2316 Excel Generator</h2>
      <p style={{fontSize:'0.9rem', color:'#64748b', marginBottom:'20px'}}>
        Auto-fill the official Excel 2316 form for your employees.
      </p>

      <div style={controlPanel}>
        <div style={{display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap'}}>
            <input 
                type="number" 
                value={year} 
                onChange={e => setYear(Number(e.target.value))} 
                style={input} 
                placeholder="Year"
            />
            
            {/* DEBUG: Show count if 0 */}
            {employees.length === 0 && (
                <span style={{color:'red', fontSize:'0.8rem'}}>
                    (No employees found or loading...)
                </span>
            )}

            <select 
                value={selectedEmpId} 
                onChange={e => setSelectedEmpId(e.target.value)} 
                style={select}
            >
                <option value="">-- Select Employee --</option>
                {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.last_name}, {e.first_name}</option>
                ))}
            </select>
            <button onClick={generateExcel} disabled={loading || !selectedEmpId} style={btnSuccess}>
                {loading ? 'Processing...' : '📥 Download Excel File'}
            </button>
        </div>
      </div>
    </div>
  );
}

// --- STYLES ---
const container = { padding: '30px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '800px', margin: '0 auto' };
const controlPanel = { background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' };
const select = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', minWidth: '200px' };
const input = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '80px', fontSize: '0.95rem' };
const btnSuccess = { background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };