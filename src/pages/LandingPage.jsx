import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LandingPage({ onSignUpClick }) {
  const [showLogin, setShowLogin] = useState(false);
  
  // FORM STATES
  const [view, setView] = useState('login'); // 'login' or 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // HANDLE LOGIN
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  };

  // HANDLE FORGOT PASSWORD
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (!email) {
        setError("Please enter your email address.");
        setLoading(false);
        return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
    });

    if (error) {
        setError(error.message);
    } else {
        setSuccessMsg("Check your email for the reset link!");
    }
    setLoading(false);
  };

  const togglePopup = () => {
      setShowLogin(!showLogin);
      setView('login');
      setError('');
      setSuccessMsg('');
  };

  return (
    <div style={{ fontFamily: '"Inter", -apple-system, sans-serif', color: '#1e293b', overflowX: 'hidden', backgroundColor: '#ffffff' }}>
      
      {/* --- HEADER --- */}
      <header style={header}>
        <div style={logo}>Payroll<span style={{color:'#2563eb'}}>Pro</span></div>
        
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <button onClick={togglePopup} style={loginBtn}>Log In</button>
                <button onClick={onSignUpClick} style={signUpHeaderBtn}>Sign Up Free</button>
            </div>

            {/* LOGIN / FORGOT PASSWORD POPUP */}
            {showLogin && (
                <div style={popup}>
                    {/* VIEW 1: LOGIN FORM */}
                    {view === 'login' && (
                        <>
                            <h4 style={{marginTop:0, marginBottom:'15px', color: '#0f172a'}}>Welcome Back</h4>
                            {error && <div style={errorStyle}>{error}</div>}
                            <form onSubmit={handleLogin} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                                <input type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} style={input} required />
                                <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={input} required />
                                <button type="submit" disabled={loading} style={submitBtn}>
                                    {loading ? 'Logging in...' : 'Access Dashboard'}
                                </button>
                            </form>
                            <div style={{marginTop: '15px', textAlign: 'center'}}>
                                <button onClick={() => { setView('forgot'); setError(''); }} style={linkBtn}>
                                    Forgot Password?
                                </button>
                            </div>
                        </>
                    )}

                    {/* VIEW 2: FORGOT PASSWORD FORM */}
                    {view === 'forgot' && (
                        <>
                            <h4 style={{marginTop:0, marginBottom:'10px', color: '#0f172a'}}>Reset Password</h4>
                            <p style={{fontSize: '0.85rem', color: '#64748b', marginBottom: '15px', lineHeight: '1.4'}}>
                                Enter your email and we'll send you a link to reset your password.
                            </p>
                            {error && <div style={errorStyle}>{error}</div>}
                            {successMsg && <div style={successStyle}>{successMsg}</div>}
                            <form onSubmit={handleForgotPassword} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                                <input type="email" placeholder="Enter your email" value={email} onChange={e=>setEmail(e.target.value)} style={input} required />
                                <button type="submit" disabled={loading} style={{...submitBtn, background: successMsg ? '#16a34a' : '#2563eb'}}>
                                    {loading ? 'Sending...' : successMsg ? 'Email Sent' : 'Send Reset Link'}
                                </button>
                            </form>
                            <div style={{marginTop: '15px', textAlign: 'center'}}>
                                <button onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }} style={linkBtn}>
                                    ← Back to Log In
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <section style={heroSection}>
        <div style={{ maxWidth: '900px', margin: 'auto', textAlign: 'center', padding: '100px 20px 60px 20px' }}>
            <div style={trustBadge}>✅ Updated for 2026 SSS & PhilHealth Tables</div>
            <h1 style={heroHeadline}>
                Philippine Payroll, <br/> <span style={{color: '#2563eb'}}>Simplified.</span>
            </h1>
            <p style={heroSub}>
                Stop wrestling with Excel. Auto-compute statutory deductions, track <strong>"Vale" / Cash Advances</strong>, 
                and generate Master Reports in one click. Built specifically for PH SMEs.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '40px' }}>
                <button onClick={onSignUpClick} style={ctaBtn}>Start Free Trial →</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '15px' }}>No credit card required • 10-day full access</p>
        </div>
      </section>

      {/* --- CORE FEATURES --- */}
      <section style={{ background: '#f8fafc', padding: '80px 20px' }}>
        <div style={{ maxWidth: '1100px', margin: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>Everything a Pinoy Business Needs</h2>
                <p style={{ color: '#64748b', marginTop: '10px' }}>We removed the clutter and kept the features that actually matter.</p>
            </div>
            
            <div style={gridContainer}>
                <FeatureCard 
                    icon="📊" 
                    title="Auto-Compute Deductions" 
                    desc="Never guess the contribution table again. We automatically calculate SSS, PhilHealth, and Pag-IBIG based on 2026 mandates." 
                />
                <FeatureCard 
                    icon="📒" 
                    title="Automated 'Vale' Ledger" 
                    desc="Track employee cash advances and automatically deduct installments from their salary every cutoff. No more manual tracking." 
                    highlight
                />
                <FeatureCard 
                    icon="🎄" 
                    title="1-Click 13th Month Pay" 
                    desc="Don't panic in December. We track total basic salary throughout the year to auto-compute pro-rated 13th month pay instantly." 
                />
                 <FeatureCard 
                    icon="🗓️" 
                    title="Smart Holiday Pay" 
                    desc="Regular Holiday or Special Non-Working? We handle the 100%, 30%, and overtime premiums automatically." 
                />
            </div>
        </div>
      </section>

      {/* --- NEW: MIGRATION & IMPORT SECTION --- */}
      <section style={{ padding: '80px 20px', background: 'white', borderTop:'1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1000px', margin: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '50px' }}>
            <div style={{ flex: '1 1 450px' }}>
                <div style={{display:'inline-block', background:'#eff6ff', color:'#2563eb', fontWeight:'bold', fontSize:'0.8rem', padding:'4px 12px', borderRadius:'20px', marginBottom:'15px'}}>FAST ONBOARDING</div>
                <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '20px', lineHeight: '1.2' }}>Move from Excel in Minutes, Not Days</h2>
                <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '30px' }}>
                    Already have employee data? Don't type them one by one. We support bulk imports to get you started immediately.
                </p>
                <div style={{display:'grid', gap:'15px'}}>
                    <div style={miniCard}>
                        <div style={miniIcon}>📂</div>
                        <div>
                            <div style={{fontWeight:'bold'}}>Bulk Employee Import</div>
                            <div style={{fontSize:'0.9rem', color:'#64748b'}}>Upload your CSV list of employees to create profiles instantly.</div>
                        </div>
                    </div>
                    <div style={miniCard}>
                        <div style={miniIcon}>⏱️</div>
                        <div>
                            <div style={{fontWeight:'bold'}}>Import Attendance Logs</div>
                            <div style={{fontSize:'0.9rem', color:'#64748b'}}>Upload time logs (CSV) to auto-fill days worked, lates, and overtime for faster payroll processing.</div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Visual Representation of Import */}
            <div style={{ flex: '1 1 400px', display:'flex', justifyContent:'center' }}>
                <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '20px', border: '2px dashed #cbd5e1', width:'100%', textAlign:'center' }}>
                    <div style={{fontSize:'3rem', marginBottom:'10px'}}>📄 ➔ 🚀</div>
                    <div style={{fontWeight:'bold', color:'#334155'}}>Drag & Drop CSV</div>
                    <div style={{fontSize:'0.8rem', color:'#94a3b8', marginTop:'5px'}}>Compatible with Excel & Google Sheets exports</div>
                    <div style={{marginTop:'20px', background:'white', padding:'10px', borderRadius:'8px', border:'1px solid #e2e8f0', textAlign:'left', fontSize:'0.8rem', color:'#64748b'}}>
                        <div>✅ Juan Dela Cruz (Imported)</div>
                        <div style={{marginTop:'5px'}}>✅ Maria Santos (Imported)</div>
                        <div style={{marginTop:'5px'}}>✅ Jose Rizal (Imported)</div>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* --- PRICING --- */}
      <section style={{ padding: '80px 20px', textAlign: 'center', background: '#f8fafc' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '10px' }}>Simple, Transparent Pricing</h2>
        <p style={{ color: '#64748b', marginBottom: '50px' }}>Pay via GCash, Maya, or Card. Cancel anytime.</p>
        
        <div style={{ maxWidth: '900px', margin: 'auto', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <PriceCard title="Monthly" price="₱499" sub="/mo" desc="Ideal for small startups" />
            <PriceCard title="Annual" price="₱3,000" sub="/yr" desc="Save ₱2,988 per year!" highlight badge="BEST VALUE" />
            <PriceCard title="Lifetime" price="₱5,000" sub="" desc="One-time payment forever" />
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer style={{ background: '#0f172a', color: '#94a3b8', padding: '60px 20px', textAlign: 'center', fontSize: '0.9rem' }}>
        <div style={{ marginBottom: '20px', color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>PayrollPro PH</div>
        
        {/* SUPPORT SECTION */}
        <div style={{ marginBottom: '30px' }}>
            <p style={{ marginBottom: '10px' }}>Need help or have questions?</p>
            <a 
                href="mailto:support.payrollpro-ph@jlsolutions.app" 
                style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '1rem', fontWeight: 'bold' }}
            >
                support.payrollpro-ph@jlsolutions.app
            </a>
        </div>

        <p>&copy; {new Date().getFullYear()} PayrollPro Philippines. All rights reserved.</p>
      </footer>
    </div>
  );
}

// --- SUB-COMPONENTS ---

const FeatureCard = ({ icon, title, desc, highlight }) => (
    <div style={{ 
        background: 'white', 
        padding: '30px', 
        borderRadius: '16px', 
        border: highlight ? '1px solid #bfdbfe' : '1px solid #f1f5f9',
        boxShadow: highlight ? '0 10px 30px -5px rgba(37, 99, 235, 0.1)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'hidden'
    }}>
        {highlight && <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#3b82f6' }} />}
        <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>{icon}</div>
        <h3 style={{ marginBottom: '12px', fontSize: '1.1rem', fontWeight: '700' }}>{title}</h3>
        <p style={{ color: '#64748b', lineHeight: '1.6', fontSize: '0.95rem' }}>{desc}</p>
    </div>
);

const PriceCard = ({ title, price, sub, desc, highlight, badge }) => (
    <div style={{ 
        background: 'white', padding: '35px 25px', borderRadius: '16px', width: '260px', 
        border: highlight ? '2px solid #3b82f6' : '1px solid #e2e8f0',
        transform: highlight ? 'scale(1.05)' : 'none',
        boxShadow: highlight ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : 'none',
        position: 'relative'
    }}>
        {badge && (
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#3b82f6', color: 'white', fontSize: '0.7rem', fontWeight: 'bold', padding: '4px 12px', borderRadius: '20px', letterSpacing: '1px' }}>
                {badge}
            </div>
        )}
        <h3 style={{ color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>{title}</h3>
        <div style={{ fontSize: '2.5rem', fontWeight: '800', margin: '15px 0', color: '#0f172a' }}>
            {price}<span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: '500' }}>{sub}</span>
        </div>
        <p style={{ color: highlight ? '#16a34a' : '#64748b', fontSize: '0.85rem', fontWeight: highlight ? 'bold' : 'normal' }}>{desc}</p>
    </div>
);

// --- STYLES ---
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 5%', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 100 };
const logo = { fontWeight: '900', fontSize: '1.5rem', color: '#0f172a', letterSpacing: '-0.5px' };
const loginBtn = { background: 'transparent', border: 'none', fontWeight: '600', color: '#475569', cursor: 'pointer', fontSize: '0.95rem', marginRight: '10px' };
const signUpHeaderBtn = { background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', transition: '0.2s' };
const popup = { position: 'absolute', top: '60px', right: '0', width: '300px', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 0 0 1px #e2e8f0', zIndex: 200 };
const input = { padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', width: '100%', boxSizing: 'border-box' };
const submitBtn = { background: '#2563eb', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%', fontSize: '0.95rem' };
const linkBtn = { background: 'none', border: 'none', color: '#2563eb', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' };
const errorStyle = { color:'#ef4444', fontSize:'0.8rem', marginBottom:'10px', background:'#fef2f2', padding:'8px', borderRadius:'4px' };
const successStyle = { color:'#15803d', fontSize:'0.8rem', marginBottom:'10px', background:'#dcfce7', padding:'8px', borderRadius:'4px' };

const heroSection = { background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)', paddingBottom: '80px' };
const heroHeadline = { fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: '900', marginBottom: '25px', lineHeight: '1.1', color: '#0f172a', letterSpacing: '-1px' };
const heroSub = { fontSize: '1.2rem', color: '#475569', marginBottom: '30px', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' };
const trustBadge = { display: 'inline-block', background: '#dbeafe', color: '#1e40af', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', marginBottom: '25px' };
const ctaBtn = { background: '#2563eb', color: 'white', border: 'none', padding: '18px 40px', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)', transition: 'transform 0.2s' };
const gridContainer = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' };

const miniCard = { display: 'flex', gap: '15px', alignItems: 'flex-start', background: '#f8fafc', padding: '15px', borderRadius: '12px' };
const miniIcon = { background: '#dbeafe', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', fontSize: '1.2rem' };