
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Function to ensure team_member exists for the authenticated user
  const ensureTeamMemberExists = async (user) => {
    if (!user || !user.email) return;

    try {
      const normalizedEmail = user.email.trim().toLowerCase();

      // Check if team_member already exists
      const { data: existingMember, error: checkError } = await supabase
        .from('team_members')
        .select('id, email, auth_user_id')
        .or(`email.eq.${normalizedEmail},auth_user_id.eq.${user.id}`)
        .limit(1);

      // If member exists, update auth_user_id if missing
      if (existingMember && existingMember.length > 0) {
        const member = existingMember[0];
        if (!member.auth_user_id && user.id) {
          // Update to link auth_user_id
          await supabase
            .from('team_members')
            .update({ auth_user_id: user.id })
            .eq('id', member.id);
        }
        return; // Member already exists
      }

      // If no member exists and check didn't error, create one
      if (!checkError || checkError.code === 'PGRST116' || checkError.code === 'PGRST301') {
        // Create new team_member entry
        const { error: insertError } = await supabase
          .from('team_members')
          .insert({
            auth_user_id: user.id,
            email: normalizedEmail,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            role: 'staff', // Default role
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error("Error creating team_member on login:", insertError);
          // Don't throw - login should still succeed even if team_member creation fails
        } else {
          console.log("Team member created automatically on login");
        }
      }
    } catch (err) {
      console.error("Error ensuring team_member exists:", err);
      // Don't throw - login should still succeed
    }
  };

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session) {
            setSession(session);
            setUser(session.user);
            // Ensure team_member exists for existing session
            if (session.user) {
              await ensureTeamMemberExists(session.user);
            }
            await fetchUserRole(session.user.email);
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error getting session:", error);
        if (mounted) setLoading(false);
      }
    }

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Ensure team_member exists when user signs in or session is refreshed
          // DISABLED: User requested to stop auto-assigning staff role
          // if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          //   await ensureTeamMemberExists(session.user);
          // }

          if (session.user.email) {
            await fetchUserRole(session.user.email);
          }
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (email) => {
    if (!email) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    try {
      // Use select with limit to avoid 406 errors when no rows exist
      const { data, error } = await supabase
        .from('team_members')
        .select('role')
        .eq('email', email)
        .limit(1);

      // Handle case where user exists in Auth but not in team_members (expected scenario)
      if (error) {
        // PGRST116 = no rows found, PGRST301 = not found - both are expected when user not in team_members
        if (error.code === 'PGRST116' || error.code === 'PGRST301') {
          setUserRole(null);
        } else {
          // Only log unexpected errors
          console.error('Error fetching user role:', error);
          setUserRole(null);
        }
      } else {
        setUserRole(data && data.length > 0 ? data[0].role : null);
      }
    } catch (err) {
      // Silently handle errors - user not found is expected
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    try {
      // Normalize email (lowercase and trim)
      const normalizedEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      if (error) {
        console.error("Supabase signin error:", error);
        return { data: null, error };
      }

      // After successful login, check and create team_member if needed
      // DISABLED: User requested to stop auto-assigning staff role
      // if (data?.user) {
      //   await ensureTeamMemberExists(data.user);
      // }

      return { data, error: null };
    } catch (err) {
      console.error("Unexpected signin error:", err);
      return {
        data: null,
        error: {
          message: err.message || "An unexpected error occurred during login"
        }
      };
    }
  };

  const signUp = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            email: email.trim().toLowerCase(),
          }
        }
      });

      if (error) {
        console.error("Supabase signup error:", error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error("Unexpected signup error:", err);
      return {
        data: null,
        error: {
          message: err.message || "An unexpected error occurred during signup"
        }
      };
    }
  };

  const value = {
    session,
    user,
    userRole,
    loading,
    signIn,
    signUp,
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
