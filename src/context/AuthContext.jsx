import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myOrganizations, setMyOrganizations] = useState([]);

  const fetchUserOrgs = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('organizations(id, name)')
        .eq('user_id', userId);
      
      if (error) throw error;
      if (data) {
        setMyOrganizations(data.map(d => d.organizations).filter(Boolean));
      }
    } catch (err) {
      console.error("Org fetch blocked or failed:", err.message);
    }
  };

  useEffect(() => {
    // Standard function-based timeout (Safe from CSP 'unsafe-eval' restrictions)
    const timer = setTimeout(() => {
      setLoading(false);
    }, 5000); // Increased to 5s to give blocked scripts more time to timeout

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          setUser(session.user);
          await fetchUserOrgs(session.user.id);
        }
      } catch (err) {
        console.error("Session init error:", err.message);
      } finally {
        clearTimeout(timer);
        setLoading(false); // Force loading off regardless of success
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchUserOrgs(session.user.id);
      } else {
        setUser(null);
        setMyOrganizations([]);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Simplified provider value for better performance
  const value = {
    user,
    loading,
    myOrganizations,
    // Add refresh manually so we can trigger it from CreateOrg later
    refreshOrgs: () => user && fetchUserOrgs(user.id)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);