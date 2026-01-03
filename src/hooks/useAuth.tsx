import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  credits: number;
  emailConfirmed: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshCredits: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const fetchCredits = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (data && !error) {
      setCredits(data.credits);
    }
  };

  // Handle email confirmation from URL hash
  const handleEmailConfirmation = async () => {
    const hash = window.location.hash;

    // Check if URL contains confirmation token (from email link)
    if (hash && (hash.includes('access_token') || hash.includes('type=signup') || hash.includes('type=email'))) {
      try {
        // Parse the hash parameters
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (accessToken && refreshToken) {
          // Set the session using the tokens from URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (!error && data.session) {
            // Session set successfully
            setEmailConfirmed(true);

            // Show success notification based on type
            if (type === 'signup') {
              toast.success('🎉 Email berhasil dikonfirmasi! Selamat datang!', {
                description: 'Akun Anda sudah aktif dan siap digunakan.',
                duration: 5000,
              });
            } else {
              toast.success('✅ Email berhasil dikonfirmasi!', {
                description: 'Silakan lanjutkan menggunakan aplikasi.',
                duration: 5000,
              });
            }

            // Clean up the URL hash to remove tokens
            window.history.replaceState(null, '', window.location.pathname);
          } else if (error) {
            console.error('Error setting session:', error);
            toast.error('Gagal memproses konfirmasi email', {
              description: error.message,
            });
          }
        }
      } catch (err) {
        console.error('Error handling email confirmation:', err);
      }
    }
  };

  useEffect(() => {
    // Handle email confirmation from URL hash FIRST
    handleEmailConfirmation();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Fetch credits after auth state change
        if (session?.user) {
          setTimeout(() => {
            fetchCredits(session.user.id);
          }, 0);
        } else {
          setCredits(0);
        }

        // Handle specific auth events
        if (event === 'SIGNED_IN' && emailConfirmed) {
          // User just confirmed email and signed in
          setEmailConfirmed(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        fetchCredits(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCredits(0);
  };

  const refreshCredits = async () => {
    if (user) {
      await fetchCredits(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, credits, emailConfirmed, signIn, signUp, signOut, refreshCredits }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
