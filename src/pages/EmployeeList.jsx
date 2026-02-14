import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AddEmployeeModal from '../components/AddEmployeeModal'; // <--- Import the new component

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false); // <--- Controls the popup

  useEffect(() => {
    fetchEmployees();
  }, []);

  async function fetchEmployees() {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('last_name', { ascending: true });

    if (error) console.error('Error:', error);
    else setEmployees(data);
    setLoading(false);
  }

  return (
    <div style={{ padding: '20px', color: '#0f172a' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#0f172a', margin: 0 }}>👥 Employee Master List</h2>
        <button 
          style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          onClick={() => setIsModalOpen(true)} // <--- Open the modal on click
        >
          + Add New Employee
        </button>
      </div>

      {loading ? (
        <p>Loading records...</p>
      ) : (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#334155' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#334155' }}>Position</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#334155' }}>Hourly Rate</th>
                <th style={{ padding: '12px', textAlign: 'left', color: '#334155' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px', color: '#0f172a' }}>{emp.last_name}, {emp.first_name}</td>
                  <td style={{ padding: '12px', color: '#334155' }}>{emp.job_title}</td>
                  <td style={{ padding: '12px', color: '#0f172a' }}>₱{emp.hourly_rate}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '12px', 
                        // Check if the text is exactly 'Active'
                        backgroundColor: emp.employment_status === 'Active' ? '#dcfce7' : '#fee2e2',
                        color: emp.employment_status === 'Active' ? '#166534' : '#991b1b',
                        fontSize: '0.8rem',
                        fontWeight: '500'
                    }}>
                        {emp.employment_status} {/* Display the text directly */}
                    </span>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* The Popup Component */}
      <AddEmployeeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={fetchEmployees} // <--- When saved, re-fetch the list automatically!
      />

    </div>
  );
}