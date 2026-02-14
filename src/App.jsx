import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';

function App() {
  const [orgs, setOrgs] = useState([]);

  useEffect(() => {
    // Function to fetch organizations from your DB
    const fetchOrgs = async () => {
      const { data, error } = await supabase.from('organizations').select('*');
      if (error) console.error('Error:', error);
      else setOrgs(data);
    };

    fetchOrgs();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Payroll App: Admin Connection Test</h1>
      <hr />
      <h3>Connected Organizations:</h3>
      {orgs.length > 0 ? (
        <ul>
          {orgs.map(org => (
            <li key={org.id}>{org.name}</li>
          ))}
        </ul>
      ) : (
        <p>No organizations found. (Make sure you added one in the Supabase SQL Editor!)</p>
      )}
    </div>
  );
}

export default App;