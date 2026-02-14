import React, { useState } from 'react';
import EmployeeList from './pages/EmployeeList';
import Payroll from './pages/Payroll'; // <--- Import the new page

function App() {
  const [currentPage, setCurrentPage] = useState('employees'); // Default page

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Sidebar */}
      <aside style={{ width: '250px', backgroundColor: '#1e293b', color: 'white', padding: '20px' }}>
        <h2 style={{ marginBottom: '40px' }}>Payroll Admin</h2>
        <nav>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            
            <li 
              onClick={() => setCurrentPage('employees')}
              style={{ 
                padding: '10px', 
                backgroundColor: currentPage === 'employees' ? '#334155' : 'transparent', 
                borderRadius: '5px', 
                marginBottom: '10px', 
                cursor: 'pointer' 
              }}>
              👥 Employees
            </li>

            <li 
              onClick={() => setCurrentPage('payroll')}
              style={{ 
                padding: '10px', 
                backgroundColor: currentPage === 'payroll' ? '#334155' : 'transparent', 
                borderRadius: '5px', 
                cursor: 'pointer' 
              }}>
              💰 Payroll Processor
            </li>

          </ul>
        </nav>
      </aside>

      {/* Main Content Area - Switches based on which button you clicked */}
      <main style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {currentPage === 'employees' && <EmployeeList />}
        {currentPage === 'payroll' && <Payroll />}
      </main>
    </div>
  );
}

export default App;