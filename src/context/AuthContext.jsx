import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Simple, direct fetch (Matches your old fetchProfile logic)
  const refreshOrgs = async (userId) => {
    if (!userId) return;
    const { data } = await supabase
      .from('organization_members')
      .select('organizations(id, name)')
      .eq('user_id', userId);
    
    if (data) {
      setMyOrganizations(data.map(d => d.organizations).filter(Boolean));
    }
  };

  useEffect(() => {
    // 1. Direct Session Check (Just like your old App.js)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        refreshOrgs(session.user.id);
      }
      setLoading(false);
    });

    // 2. Auth Listener (The "Heartbeat")
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        refreshOrgs(session.user.id);
      } else {
        setUser(null);
        setMyOrganizations([]);
      }
      setLoading(false);
    });

    // 3. Tab Focus Recovery (The "Poke")
    const handleFocus = () => {
        if (document.visibilityState === 'visible') {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) refreshOrgs(session.user.id);
            });
        }
    };
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      if (authListener?.subscription?.unsubscribe) authListener.subscription.unsubscribe();
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, myOrganizations, loading, refreshOrgs }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);