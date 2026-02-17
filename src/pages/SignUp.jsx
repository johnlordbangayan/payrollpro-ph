import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function SignUp({ onLoginClick }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        emailRedirectTo: window.location.origin, // Redirects them back here after clicking link
      }
    });

    if (error) {
      alert(error.message);
    } else {
      setIsSubmitted(true);
    }
    setLoading(false);
  };

  if (isSubmitted) {
    return (
      <div style={container}>
        <div style={card}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📧</div>
          <h2>Check your email</h2>
          <p style={{ color: '#64748b', lineHeight: '1.6' }}>
            We've sent a magic link to <strong>{email}</strong>. 
            Please click the link in your inbox to verify your account and start your 10-day trial.
          </p>
          <button onClick={onLoginClick} style={secondaryBtn}>Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <div style={card}>
        <div style={logo}>Payroll<span style={{color:'#3b82f6'}}>Pro</span></div>
        <h2 style={{ marginBottom: '10px' }}>Create your account</h2>
        <p style={{ color: '#64748b', marginBottom: '30px', fontSize: '0.9rem' }}>
          No credit card required. 10 days free trial starts now.
        </p>

        <form onSubmit={handleSignUp} style={formStyle}>
          <div style={inputGroup}>
            <label style={label}>Business Email</label>
            <input 
              type="email" 
              placeholder="name@company.com" 
              style={input} 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div style={inputGroup}>
            <label style={label}>Password</label>
            <input 
              type="password" 
              placeholder="Minimum 6 characters" 
              style={input} 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" disabled={loading} style={primaryBtn}>
            {loading ? 'Creating Account...' : 'Start My Free Trial'}
          </button>
        </form>

        <p style={footerText}>
          Already have an account? <span onClick={onLoginClick} style={link}>Log In</span>
        </p>
      </div>
    </div>
  );
}

// STYLES
const container = { 
  minHeight: '100vh', 
  display: 'flex', 
  justifyContent: 'center', 
  alignItems: 'center', 
  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  padding: '20px'
};

const card = { 
  background: 'white', 
  padding: '40px', 
  borderRadius: '24px', 
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', 
  width: '100%', 
  maxWidth: '440px',
  textAlign: 'center'
};

const logo = { fontWeight: '900', fontSize: '1.5rem', color: '#1e293b', marginBottom: '20px' };

const formStyle = { display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' };

const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };

const label = { fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' };

const input = { 
  padding: '12px 16px', 
  borderRadius: '10px', 
  border: '1px solid #cbd5e1', 
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.2s'
};

const primaryBtn = { 
  marginTop: '10px',
  padding: '14px', 
  background: '#3b82f6', 
  color: 'white', 
  border: 'none', 
  borderRadius: '10px', 
  fontSize: '1rem', 
  fontWeight: 'bold', 
  cursor: 'pointer',
  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.5)'
};

const secondaryBtn = {
  marginTop: '20px',
  padding: '10px 20px',
  background: 'none',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  cursor: 'pointer',
  color: '#475569',
  fontWeight: '600'
};

const footerText = { marginTop: '25px', fontSize: '0.9rem', color: '#64748b' };

const link = { color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer', marginLeft: '5px' };