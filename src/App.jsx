import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './context/AuthContext';

// --- PAGES ---
import LandingPage from './pages/LandingPage';
import SignUp from './pages/SignUp';
import SelectOrg from './pages/SelectOrg';
import CreateOrg from './pages/CreateOrg';
import EmployeeList from './pages/EmployeeList';
import PayrollDashboard from './pages/PayrollDashboard';
import PayrollHistory from './pages/PayrollHistory';
import HolidayManager from './pages/HolidayManager';
import OrgSettings from './pages/OrgSettings';
import PayrollReport from './pages/PayrollReport';
import MonthlyDeductions from './pages/MonthlyDeductions';
import ThirteenthMonth from './pages/ThirteenthMonth';
import LoanManager from './pages/LoanManager';
import UserProfile from './pages/UserProfile';

// --- BIR FORMS ---
import BIR1601C from './pages/BIR1601C';
import BIR2316Excel from './pages/BIR2316Excel';

function App() {
  const { user, loading: authLoading } = useAuth();
  
  // --- NAVIGATION STATES ---
  const [publicView, setPublicView] = useState('landing'); 
  const [currentView, setCurrentView] = useState('select'); 
  const [subView, setSubView] = useState('employees'); 
  
  // --- DROPDOWN STATE ---
  const [showBirMenu, setShowBirMenu] = useState(false);

  // --- SYSTEM STATES ---
  const [syncing, setSyncing] = useState(false); 
  const [showToast, setShowToast] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0); 
  const [dbStatus, setDbStatus] = useState('online');
  const [trialExpired, setTrialExpired] = useState(false);

  // --- ORGANIZATION STATE ---
  const [activeOrg, setActiveOrg] = useState(() => {
    const savedOrg = localStorage.getItem('activeOrg');
    return savedOrg ? JSON.parse(savedOrg) : null;
  });

  // 1. STABLE CONNECTION RECOVERY
  const recoverConnection = useCallback(async (background = false) => {
    if (!background) setShowToast(true);
    try {
      const { data: { session }, error: authError } = await supabase.auth.refreshSession();
      if (authError || !session) throw new Error("Stale session");
      setDbStatus('online');
    } catch (err) {
      console.warn("Connection weak: Retrying session...");
      setDbStatus('offline');
    } finally {
      if (!background) setTimeout(() => setShowToast(false), 1500);
    }
  }, []);

  // 2. TRIAL & FOCUS LISTENERS
  useEffect(() => {
    if (!user) return;

    const checkSubscription = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_end_date, subscription_status')
          .eq('id', user.id)
          .maybeSingle();

        const today = new Date();
        let isExpired = false;

        if (profile) {
          if (profile.subscription_status !== 'lifetime') {
            const expiry = new Date(profile.subscription_end_date);
            isExpired = today > expiry;
          }
        } else {
          const startDate = new Date(user.created_at);
          const diffDays = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
          isExpired = diffDays > 10;
        }

        setTrialExpired(isExpired);
        if (isExpired && activeOrg && subView !== 'profile') setSubView('profile');
      } catch (err) {
        console.error("Subscription check failed:", err);
      }
    };

    checkSubscription();

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        console.log("App Waking Up: Verifying secure connection...");
        recoverConnection(true); 
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [user, activeOrg, subView, recoverConnection]);

  // 3. ORGANIZATION SYNC
  useEffect(() => {
    let isMounted = true;
    const syncOrgSettings = async () => {
      if (activeOrg?.id) {
        setSyncing(true); 
        try {
          const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', activeOrg.id)
            .single();
            
          if (isMounted && !error && data) {
            setActiveOrg(data);
            localStorage.setItem('activeOrg', JSON.stringify(data));
          }
        } finally { 
          if (isMounted) setSyncing(false); 
        }
      }
    };
    syncOrgSettings();
    return () => { isMounted = false; };
  }, [activeOrg?.id, reconnectKey]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('activeOrg');
    setActiveOrg(null);
    setPublicView('landing');
  };

  // --- NAVIGATION HELPERS ---
  const handleNavClick = (view) => {
    setSubView(view);
    setShowBirMenu(false); // Close dropdown if clicking other tabs
  };

  const isBirActive = ['bir_1601c', 'bir_2316'].includes(subView);

  // --- RENDER HELPERS ---
  if (authLoading) return <div style={loadingOverlay}>Verifying Session...</div>;

  if (!user) {
    return publicView === 'signup' 
      ? <SignUp onLoginClick={() => setPublicView('landing')} /> 
      : <LandingPage onSignUpClick={() => setPublicView('signup')} />;
  }

  if (activeOrg) {
    return (
      <div key={reconnectKey} style={appWrapper}>
        {showToast && <div style={toastStyle}>🔄 Syncing Secure Data...</div>}

        <header style={headerStyle}>
          <div style={headerTopRow}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.2rem' }}>🏢 {activeOrg.name}</h2>
              <div 
                onClick={() => recoverConnection(false)}
                title={dbStatus === 'online' ? "System Online" : "System Offline - Click to Refresh"}
                style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  backgroundColor: dbStatus === 'online' ? '#10b981' : '#ef4444',
                  boxShadow: dbStatus === 'online' ? '0 0 8px #10b981' : 'none',
                  cursor: 'pointer', transition: '0.3s'
                }} 
              />
            </div>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                {!trialExpired && (
                    <button onClick={() => { setActiveOrg(null); setSubView('employees'); }} style={switchBtn}>← Switch Org</button>
                )}
                <div onClick={() => setSubView('profile')} style={profileCircle}>
                    {user.email[0].toUpperCase()}
                </div>
            </div>
          </div>
          
          {!trialExpired ? (
              <nav style={navBarContainer}>
                <button onClick={() => handleNavClick('employees')} style={subView === 'employees' ? navActive : navInactive}>Employees</button>
                <button onClick={() => handleNavClick('payroll')} style={subView === 'payroll' ? navActive : navInactive}>Payroll Run</button>
                <button onClick={() => handleNavClick('loans')} style={subView === 'loans' ? navActive : navInactive}>💰 Loans</button>
                <button onClick={() => handleNavClick('history')} style={subView === 'history' ? navActive : navInactive}>History</button>
                <button onClick={() => handleNavClick('report')} style={subView === 'report' ? navActive : navInactive}>Master Report</button>
                <button onClick={() => handleNavClick('monthly')} style={subView === 'monthly' ? navActive : navInactive}>Monthly Ded.</button>
                <button onClick={() => handleNavClick('thirteenth')} style={subView === 'thirteenth' ? navActive : navInactive}>13th Month</button>
                
                {/* --- BIR DROPDOWN --- */}
                <div style={{ position: 'relative' }}>
                    <button 
                        onClick={() => setShowBirMenu(!showBirMenu)} 
                        style={isBirActive ? navActive : navInactive}
                    >
                        🏛️ BIR Forms ▾
                    </button>
                    {showBirMenu && (
                        <div style={dropdownStyle}>
                            <button onClick={() => { setSubView('bir_1601c'); setShowBirMenu(false); }} style={dropdownItem}>
                                Form 1601-C (Monthly)
                            </button>
                            <button onClick={() => { setSubView('bir_2316'); setShowBirMenu(false); }} style={dropdownItem}>
                                Form 2316 (Annual)
                            </button>
                        </div>
                    )}
                </div>

                <button onClick={() => handleNavClick('holidays')} style={subView === 'holidays' ? navActive : navInactive}>Holidays</button>
                <button onClick={() => handleNavClick('settings')} style={subView === 'settings' ? navActive : navInactive}>Settings</button>
              </nav>
          ) : (
              <div style={expiredBanner}>⚠️ Subscription Required to Access Dashboard</div>
          )}
        </header>

        <main style={{ padding: '20px', maxWidth: '1600px', margin: 'auto', minHeight: '80vh' }} onClick={() => setShowBirMenu(false)}>
            {syncing && subView !== 'profile' ? (
                <div style={syncOverlayStyle}>Refreshing Org Settings...</div>
            ) : (
                <>
                    {subView === 'profile' && <UserProfile user={user} onLogout={handleLogout} onBack={() => setSubView('employees')} />}
                    {!trialExpired && subView !== 'profile' && (
                        <>
                            {subView === 'employees' && <EmployeeList organizationId={activeOrg.id} />}
                            {subView === 'payroll' && activeOrg?.deduction_labels && <PayrollDashboard organizationId={activeOrg.id} orgSettings={activeOrg} />}
                            {subView === 'loans' && <LoanManager organizationId={activeOrg.id} />}
                            {subView === 'history' && <PayrollHistory organizationId={activeOrg.id} />}
                            {subView === 'report' && activeOrg?.deduction_labels && <PayrollReport organizationId={activeOrg.id} orgSettings={activeOrg} />}
                            {subView === 'monthly' && <MonthlyDeductions organizationId={activeOrg.id} orgSettings={activeOrg} />}
                            {subView === 'thirteenth' && <ThirteenthMonth organizationId={activeOrg.id} orgSettings={activeOrg} />}
                            
                            {/* --- BIR VIEWS --- */}
                            {subView === 'bir_1601c' && <BIR1601C organizationId={activeOrg.id} orgSettings={activeOrg} />}
                            {subView === 'bir_2316' && <BIR2316Excel organizationId={activeOrg.id} orgSettings={activeOrg} />}

                            {subView === 'holidays' && <HolidayManager organizationId={activeOrg.id} />}
                            {subView === 'settings' && <OrgSettings org={activeOrg} onUpdate={setActiveOrg} />}
                        </>
                    )}
                </>
            )}
        </main>
      </div>
    );
  }

  if (currentView === 'create') return <CreateOrg onCancel={() => setCurrentView('select')} onSuccess={() => setCurrentView('select')} />;
  return <SelectOrg onCreateClick={() => setCurrentView('create')} onSelect={setActiveOrg} />;
}

// --- REFINED STYLES ---
const appWrapper = { minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' };
const headerStyle = { backgroundColor: '#1e293b', color: 'white', padding: '16px 30px', display: 'flex', flexDirection: 'column', gap: '15px', position: 'sticky', top: 0, zIndex: 1000, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
const headerTopRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const navBarContainer = { display: 'flex', gap: '8px', flexWrap: 'wrap' };
const toastStyle = { position: 'fixed', top: '85px', right: '20px', background: '#3b82f6', color: 'white', padding: '12px 24px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold', zIndex: 9999, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };
const syncOverlayStyle = { height: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#94a3b8', fontWeight: '600', fontSize: '1.1rem' };
const loadingOverlay = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9', fontWeight: 'bold', fontSize: '1.2rem', color: '#1e293b' };
const navActive = { padding: '10px 18px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', transition: '0.2s' };
const navInactive = { padding: '10px 18px', backgroundColor: 'transparent', color: '#94a3b8', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', transition: '0.2s' };
const switchBtn = { backgroundColor: '#334155', color: '#e2e8f0', border: 'none', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' };
const profileCircle = { width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid rgba(255,255,255,0.2)' };
const expiredBanner = { padding: '12px', background: '#ef4444', color: 'white', borderRadius: '10px', fontSize: '0.85rem', textAlign: 'center', marginTop: '5px', fontWeight: 'bold', letterSpacing: '0.025em' };

// --- DROPDOWN STYLES ---
const dropdownStyle = {
    position: 'absolute',
    top: '110%',
    left: 0,
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    border: '1px solid #e2e8f0',
    minWidth: '180px',
    zIndex: 50,
    overflow: 'hidden',
    padding: '5px 0'
};

const dropdownItem = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 15px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#334155',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '500',
    transition: 'background 0.2s'
};

export default App;