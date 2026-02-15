import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import SelectOrg from './pages/SelectOrg';
import CreateOrg from './pages/CreateOrg';
import EmployeeList from './pages/EmployeeList';
import PayrollDashboard from './pages/PayrollDashboard';
import PayrollHistory from './pages/PayrollHistory';
import HolidayManager from './pages/HolidayManager';
import OrgSettings from './pages/OrgSettings';
import PayrollReport from './pages/PayrollReport';
import MonthlyDeductions from './pages/MonthlyDeductions';
import LoanManager from './pages/LoanManager'; // <--- NEW IMPORT

function App() {
  const { user, loading: authLoading } = useAuth();
  const [currentView, setCurrentView] = useState('select'); 
  const [subView, setSubView] = useState('employees'); 
  const [syncing, setSyncing] = useState(false); 
  const [showToast, setShowToast] = useState(false);
  
  const [reconnectKey, setReconnectKey] = useState(0); 
  const [dbStatus, setDbStatus] = useState('online');

  const [activeOrg, setActiveOrg] = useState(() => {
    const savedOrg = localStorage.getItem('activeOrg');
    return savedOrg ? JSON.parse(savedOrg) : null;
  });

  // --- 1. CONNECTION RECOVERY ---
  const recoverConnection = useCallback(async () => {
    setShowToast(true);
    try {
      const { data: { session }, error: authError } = await supabase.auth.refreshSession();
      if (authError || !session) throw new Error("Stale");

      const { error: dbError } = await supabase.from('payroll_config').select('key').limit(1);
      if (dbError) throw dbError;

      setDbStatus('online');
    } catch (err) {
      console.warn("⚠️ Handshake failed. Rebooting UI...");
      setDbStatus('offline');
      setReconnectKey(prev => prev + 1); 
    } finally {
      setTimeout(() => setShowToast(false), 2000);
    }
  }, []);

  useEffect(() => {
    const handleTabFocus = () => {
      if (document.visibilityState === 'visible') recoverConnection();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('activeOrg');
        window.location.reload();
      }
    });

    document.addEventListener('visibilitychange', handleTabFocus);
    window.addEventListener('focus', handleTabFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleTabFocus);
      window.removeEventListener('focus', handleTabFocus);
      subscription.unsubscribe();
    };
  }, [recoverConnection]);

  // --- 2. HEARTBEAT ---
  useEffect(() => {
    const heartbeat = setInterval(async () => {
      if (document.visibilityState === 'visible' && user) {
        const { error } = await supabase.from('payroll_config').select('key').limit(1);
        setDbStatus(error ? 'offline' : 'online');
      }
    }, 45000); 
    return () => clearInterval(heartbeat);
  }, [user]);

  // --- 3. ORG SYNC ---
  useEffect(() => {
    let isMounted = true;
    const syncOrgSettings = async () => {
      if (activeOrg?.id) {
        setSyncing(true); 
        try {
          const { data, error } = await supabase.from('organizations').select('*').eq('id', activeOrg.id).single();
          if (isMounted && !error && data) {
            setActiveOrg(data);
            localStorage.setItem('activeOrg', JSON.stringify(data));
          }
        } finally { if (isMounted) setSyncing(false); }
      }
    };
    syncOrgSettings();
    return () => { isMounted = false; };
  }, [activeOrg?.id, reconnectKey]);

  if (authLoading) return <div style={loadingOverlay}>Verifying User Session...</div>;
  if (!user) return <Login />;

  if (activeOrg) {
    return (
      <div key={reconnectKey} style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' }}>
        
        {showToast && <div style={toastStyle}>🔄 Refreshing Data...</div>}

        <header style={headerStyle}>
          <div style={headerTopRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem' }}>🏢 {activeOrg.name}</h2>
              <div 
                onClick={recoverConnection}
                title={dbStatus === 'online' ? "Connected" : "Disconnected - Click to Reconnect"}
                style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  backgroundColor: dbStatus === 'online' ? '#10b981' : '#ef4444',
                  boxShadow: dbStatus === 'online' ? '0 0 8px #10b981' : 'none',
                  cursor: 'pointer', transition: 'all 0.3s ease'
                }} 
              />
            </div>
            <button onClick={() => { setActiveOrg(null); setSubView('employees'); }} style={switchBtn}>← Switch Org</button>
          </div>
          
          <nav style={navBarContainer}>
            <button onClick={() => setSubView('employees')} style={subView === 'employees' ? navActive : navInactive}>Employees</button>
            <button onClick={() => setSubView('payroll')} style={subView === 'payroll' ? navActive : navInactive}>Payroll Run</button>
            <button onClick={() => setSubView('loans')} style={subView === 'loans' ? navActive : navInactive}>💰 Loans</button>
            <button onClick={() => setSubView('history')} style={subView === 'history' ? navActive : navInactive}>History</button>
            <button onClick={() => setSubView('report')} style={subView === 'report' ? navActive : navInactive}>Master Report</button>
            <button onClick={() => setSubView('monthly')} style={subView === 'monthly' ? navActive : navInactive}>Monthly Ded.</button>
            <button onClick={() => setSubView('holidays')} style={subView === 'holidays' ? navActive : navInactive}>Holidays</button>
            <button onClick={() => setSubView('settings')} style={subView === 'settings' ? navActive : navInactive}>Settings</button>
          </nav>
        </header>

        {syncing ? (
          <div style={syncOverlayStyle}>
             <div style={{ fontSize: '2rem', animation: 'spin 2s linear infinite' }}>🔄</div>
             <div style={{ fontWeight: 'bold' }}>Syncing Data...</div>
          </div>
        ) : (
          <main style={{ padding: '20px' }}>
            {subView === 'employees' && <EmployeeList organizationId={activeOrg.id} />}
            {subView === 'payroll' && activeOrg?.deduction_labels && (
              <PayrollDashboard organizationId={activeOrg.id} orgSettings={activeOrg} />
            )}
            {/* --- NEW LOAN VIEW --- */}
            {subView === 'loans' && <LoanManager organizationId={activeOrg.id} />}
            
            {subView === 'history' && <PayrollHistory organizationId={activeOrg.id} />}
            {subView === 'report' && activeOrg?.deduction_labels && (
              <PayrollReport organizationId={activeOrg.id} orgSettings={activeOrg} />
            )}
            {subView === 'monthly' && (
              <MonthlyDeductions organizationId={activeOrg.id} orgSettings={activeOrg} />
            )}
            {subView === 'holidays' && <HolidayManager organizationId={activeOrg.id} />}
            {subView === 'settings' && <OrgSettings org={activeOrg} onUpdate={setActiveOrg} />}
          </main>
        )}
      </div>
    );
  }

  if (currentView === 'create') return <CreateOrg onCancel={() => setCurrentView('select')} onSuccess={() => setCurrentView('select')} />;
  return <SelectOrg onCreateClick={() => setCurrentView('create')} onSelect={setActiveOrg} />;
}

// --- STYLES ---
const headerStyle = { backgroundColor: '#1e293b', color: 'white', padding: '12px 30px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: 0, zIndex: 1000 };
const headerTopRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const navBarContainer = { display: 'flex', gap: '5px', flexWrap: 'wrap' };
const toastStyle = { position: 'fixed', top: '80px', right: '20px', background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 9999 };
const syncOverlayStyle = { height: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '20px', color: '#64748b' };
const loadingOverlay = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', color: '#1e293b', fontWeight: 'bold' };
const navActive = { padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' };
const navInactive = { padding: '8px 16px', backgroundColor: 'transparent', color: '#94a3b8', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' };
const switchBtn = { backgroundColor: '#334155', color: '#e2e8f0', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' };

export default App;