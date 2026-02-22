import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [organization, setOrganization] = useState(null);

  // --- 1. THE "BRAIN": FETCH ORGANIZATIONS ---
  // This function is now a separate, reusable logic block
  const fetchUserOrgs = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          organizations (id, name, subscription_status, trial_ends_at)
        `)
        .eq('user_id', userId);

      if (error) throw error;

      const orgs = data?.map(d => d.organizations).filter(Boolean) || [];
      setMyOrganizations(orgs);
      return orgs;
    } catch (err) {
      console.error("Org fetch failed:", err.message);
      return [];
    }
  };

  // --- 2. THE "STABALIZER": INITIALIZATION ---
  // This runs immediately on page refresh
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true); // Ensure loading is ON
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          // CRITICAL: We await the orgs so the list isn't empty on refresh
          await fetchUserOrgs(session.user.id);
        }
      } catch (err) {
        console.error("Auth Init Error:", err);
      } finally {
        setLoading(false); // Only turn off loading after data is ready
      }
    };

    initializeAuth();

    // --- 3. THE "LISTENER": AUTH CHANGES ---
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchUserOrgs(session.user.id);
      } else {
        // Clear everything on Logout
        setUser(null);
        setMyOrganizations([]);
        setOrganization(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 4. THE "CLEANER": SIGN OUT ---
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      
      // Clear local storage to prevent "ghost" sessions
      localStorage.clear();
      
      setUser(null);
      setMyOrganizations([]);
      setOrganization(null);
    } catch (err) {
      console.error("Signout error:", err);
    } finally {
      // Hard refresh to login page
      window.location.replace('/'); 
    }
  };

  const value = {
    user,
    loading,
    myOrganizations,
    organization,
    setOrganization,
    signOut,
    refreshOrgs: () => user && fetchUserOrgs(user.id)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);