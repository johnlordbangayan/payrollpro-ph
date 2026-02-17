import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LandingPage({ onSignUpClick }) {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <div style={lpContainer}>
      {/* NAVIGATION BAR */}
      <nav style={lpNav}>
        <div style={lpLogo}>Payroll<span style={{color:'#3b82f6'}}>Pro</span></div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', position: 'relative' }}>
          <button onClick={() => setShowLoginPopup(!showLoginPopup)} style={lpLoginBtn}>Log In</button>
          <button onClick={onSignUpClick} style={lpSignUpBtn}>Sign Up Free</button>

          {/* MINI LOGIN POPUP */}
          {showLoginPopup && (
            <div style={miniPopup}>
              <h4 style={{marginTop: 0}}>Member Login</h4>
              <form onSubmit={handleLogin} style={popupForm}>
                <input type="email" placeholder="Email" style={lpInput} onChange={e=>setEmail(e.target.value)} required />
                <input type="password" placeholder="Password" style={lpInput} onChange={e=>setPassword(e.target.value)} required />
                <button type="submit" style={lpSubmitBtn}>{loading ? '...' : 'Sign In'}</button>
              </form>
            </div>
          )}
        </div>
      </nav>

      {/* HERO SECTION */}
      <header style={heroSection}>
        <h1>Philippines' Simple <br/><span style={{color: '#3b82f6'}}>Payroll Solution</span></h1>
        <p>Automated SSS, PhilHealth, Pag-IBIG. 100% compliant. 0% headache.</p>
        <button onClick={onSignUpClick} style={mainCta}>Start 10-Day Free Trial</button>
      </header>

      {/* PRICING SECTION */}
      <section style={pricingSection}>
        <h2>Affordable Plans for Every Business</h2>
        <div style={pricingGrid}>
          <PriceCard title="Monthly" price="₱599" note="/month" />
          <PriceCard title="Annual" price="₱3,000" note="/year" highlight={true} />
          <PriceCard title="Lifetime" price="₱5,000" note="One-time" />
        </div>
      </section>
    </div>
  );
}

// Small helper component for pricing
const PriceCard = ({ title, price, note, highlight }) => (
  <div style={{...pCard, border: highlight ? '2px solid #3b82f6' : '1px solid #e2e8f0'}}>
    <h3>{title}</h3>
    <div style={pPrice}>{price}</div>
    <div style={pNote}>{note}</div>
    <button style={pBtn}>Choose Plan</button>
  </div>
);

// STYLES
const lpContainer = { fontFamily: 'Inter, sans-serif', color: '#1e293b' };
const lpNav = { display: 'flex', justifyContent: 'space-between', padding: '20px 50px', alignItems: 'center', background: 'white', borderBottom: '1px solid #f1f5f9' };
const lpLogo = { fontSize: '1.5rem', fontWeight: '900' };
const lpLoginBtn = { background: 'none', border: 'none', fontWeight: 'bold', color: '#64748b', cursor: 'pointer' };
const lpSignUpBtn = { background: '#1e293b', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' };
const miniPopup = { position: 'absolute', top: '50px', right: 0, background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '250px', zIndex: 1000, border: '1px solid #e2e8f0' };
const popupForm = { display: 'flex', flexDirection: 'column', gap: '10px' };
const lpInput = { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' };
const lpSubmitBtn = { background: '#3b82f6', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' };
const heroSection = { textAlign: 'center', padding: '100px 20px', background: 'linear-gradient(to bottom, #ffffff, #f8fafc)' };
const mainCta = { marginTop: '30px', padding: '15px 40px', fontSize: '1.1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)' };
const pricingSection = { padding: '80px 50px', textAlign: 'center' };
const pricingGrid = { display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '50px', flexWrap: 'wrap' };
const pCard = { background: 'white', padding: '40px', borderRadius: '16px', width: '280px', textAlign: 'center' };
const pPrice = { fontSize: '2.5rem', fontWeight: 'bold', margin: '10px 0' };
const pNote = { color: '#64748b', marginBottom: '20px' };
const pBtn = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #3b82f6', color: '#3b82f6', background: 'white', fontWeight: 'bold', cursor: 'pointer' };