import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // 1. CLEAR STALE ORG DATA ON LANDING
  // If the user is on the login page, they shouldn't have an 'activeOrg' saved.
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        localStorage.removeItem('activeOrg'); //
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 2. Clear any old org data right before trying to log in
      localStorage.removeItem('activeOrg'); //

      const { error } = isSignUp 
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error("Auth Error:", error.message);
        alert(error.message);
      } else if (isSignUp) {
        alert("Registration successful! Check your email.");
      }
    } catch (err) {
      console.error("Critical Auth Failure:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', width: '320px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        
        <input 
          type="email" 
          placeholder="Email" 
          required 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} 
        />
        
        <input 
          type="password" 
          placeholder="Password" 
          required 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ width: '100%', padding: '10px', marginBottom: '20px', borderRadius: '6px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} 
        />

        <button 
          type="submit" 
          disabled={loading} 
          style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Login')}
        </button>

        <button 
          type="button"
          onClick={() => setIsSignUp(!isSignUp)} 
          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'center', marginTop: '15px', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
        </button>
      </form>
    </div>
  );
}