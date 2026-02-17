import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import EmployeeModal from './EmployeeModal'; 

export default function EmployeeList({ organizationId }) {
  const fileInputRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // 1. FETCH LOGIC
  const fetchEmployees = async (showLoading = true) => {
    if (showLoading && employees.length === 0) setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('organization_id', organizationId)
        .order('last_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- RECOVERY LOGIC (The Focus Fix) ---
  useEffect(() => {
    fetchEmployees();

    const handleFocus = () => {
      // We only auto-refresh if the user isn't currently editing (Modal closed)
      if (document.visibilityState === 'visible' && !isModalOpen) {
        fetchEmployees(false); // false means "don't show the loading screen"
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [organizationId, isModalOpen]);

  // --- HANDLERS ---
  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const masterFields = [
    "employee_id_number", "first_name", "middle_name", "last_name", "extension_name",
    "email", "phone_number", "position", "department", "employment_status",
    "employment_type", "date_hired", "salary_rate", "tin_number", 
    "sss_number", "philhealth_number", "pagibig_number"
  ];

  const handleExport = () => {
    const rows = employees.map(e => masterFields.map(f => e[f] || ''));
    const csvContent = "data:text/csv;charset=utf-8," + [masterFields, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Full_Employee_Masterlist.csv`);
    link.click();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async ({ target }) => {
      try {
        const lines = target.result.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) throw new Error("CSV file is empty.");
        const csvHeaders = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        let newCount = 0;
        let updateCount = 0;

        const payload = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj = { organization_id: organizationId };
          masterFields.forEach(field => {
            const index = csvHeaders.indexOf(field);
            if (index !== -1) {
              let val = values[index];
              if (field === 'salary_rate' && val) {
                val = parseFloat(val.toString().replace(/[^0-9.]/g, '')) || 0;
              }
              obj[field] = val === "" ? null : val;
            }
          });
          const exists = employees.some(emp => String(emp.employee_id_number) === String(obj.employee_id_number));
          if (exists) updateCount++; else newCount++;
          return obj;
        });

        const { error } = await supabase.from('employees').upsert(payload, { onConflict: 'employee_id_number, organization_id' });
        if (error) throw error;
        alert(`Bulk Sync Successful!\n\n✨ New: ${newCount}\n📝 Updated: ${updateCount}`);
        fetchEmployees(false);
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) alert(error.message);
    else fetchEmployees(false);
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.first_name} ${emp.last_name} ${emp.employee_id_number} ${emp.department}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. RENDER LOGIC
  if (loading && employees.length === 0) {
    return <div style={{ height: '70vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748b', fontWeight: 'bold' }}>Syncing Data...</div>;
  }

  return (
    <div style={containerStyle}>
      <div style={headerSection}>
        <div>
          <h2 style={{ margin: 0 }}>👥 Employee Directory</h2>
          <p style={subText}>Manage workforce manually or via bulk CSV sync.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExport} style={secondaryBtn}>📤 Export Master</button>
          <input type="file" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} accept=".csv" />
          <button onClick={() => fileInputRef.current.click()} style={importBtn}>📥 Import CSV</button>
          <button onClick={handleAddNew} style={addBtn}>+ Add Employee</button>
        </div>
      </div>

      <div style={filterBar}>
        <input 
          type="text" 
          placeholder="🔍 Search name, ID number, or department..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchStyle}
        />
      </div>

      <div style={tableCard}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadStyle}>
              <th style={th}>ID & Status</th>
              <th style={th}>Full Name</th>
              <th style={th}>Dept & Position</th>
              <th style={th}>Salary Rate</th>
              <th style={{ ...th, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map(emp => (
              <tr key={emp.id} style={trStyle}>
                <td style={td}>
                   <div style={{fontWeight:'bold'}}>{emp.employee_id_number}</div>
                   <span style={emp.employment_status === 'Active' ? statusActive : statusInactive}>{emp.employment_status}</span>
                </td>
                <td style={td}>
                  <strong>{emp.last_name.toUpperCase()}, {emp.first_name}</strong>
                  <div style={{fontSize:'0.75rem', color:'#64748b'}}>{emp.email || 'No email'}</div>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 'bold' }}>{emp.department}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{emp.position}</div>
                </td>
                <td style={td}>₱{Number(emp.salary_rate).toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button onClick={() => handleEdit(emp)} style={editBtn}>Edit</button>
                  <button onClick={() => handleDelete(emp.id, emp.last_name)} style={delBtn}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <EmployeeModal 
          organizationId={organizationId} 
          employee={editingEmployee}
          onClose={() => { setIsModalOpen(false); setEditingEmployee(null); }} 
          onSuccess={() => { setIsModalOpen(false); setEditingEmployee(null); fetchEmployees(false); }} 
        />
      )}
    </div>
  );
}

// --- ALL STYLES RE-ADDED ---
const containerStyle = { maxWidth: '1400px', margin: 'auto', padding: '20px' };
const headerSection = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const subText = { color: '#64748b', fontSize: '0.85rem' };
const filterBar = { marginBottom: '20px' };
const searchStyle = { width: '100%', padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' };
const addBtn = { background: '#2563eb', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const importBtn = { background: '#6366f1', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const secondaryBtn = { background: '#f8fafc', color: '#64748b', padding: '12px 24px', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' };
const tableCard = { background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const theadStyle = { background: '#f8fafc', textAlign: 'left' };
const th = { padding: '16px', fontSize: '0.7rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' };
const td = { padding: '16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' };
const trStyle = { transition: 'background 0.2s' };
const statusActive = { padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' };
const statusInactive = { padding: '2px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' };
const editBtn = { background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', marginRight: '5px' };
const delBtn = { background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' };