import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session && !loading) {
      // Small delay to ensure session is fully set
      setTimeout(() => {
        window.location.href = '/calendar';
      }, 100);
    }
  }, [session, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();

    // Validation
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all fields.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Normalize email (lowercase and trim)
      const normalizedEmail = email.trim().toLowerCase();

      const { data, error } = await signIn(normalizedEmail, password);

      if (error) {
        console.error("Login error:", error);
        let errorMessage = "Failed to log in. Please check your credentials.";
        const isEmailNotConfirmed = error.message?.includes("Email not confirmed") ||
          error.message?.includes("email_not_confirmed") ||
          error.code === "email_not_confirmed" ||
          error.error_code === "email_not_confirmed";

        // Handle specific Supabase errors
        if (isEmailNotConfirmed) {
          errorMessage = "Please verify your email address before logging in. Check your inbox (and spam folder) for the confirmation email. You can resend it below.";
        } else if (error.message?.includes("Invalid login credentials") ||
          error.message?.includes("Invalid email or password")) {
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
        } else if (error.message?.includes("Too many requests")) {
          errorMessage = "Too many login attempts. Please wait a moment and try again.";
        } else {
          errorMessage = error.message || errorMessage;
        }

        toast({
          variant: "destructive",
          title: "Login Failed",
          description: errorMessage,
        });

        // Show resend email option if email not confirmed
        if (isEmailNotConfirmed) {
          setTimeout(() => {
            toast({
              title: "Resend Confirmation Email?",
              description: "Click the button below to resend the confirmation email.",
              action: (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const { error: resendError } = await supabase.auth.resend({
                        type: 'signup',
                        email: normalizedEmail
                      });
                      if (resendError) {
                        toast({
                          variant: "destructive",
                          title: "Failed to resend email",
                          description: resendError.message,
                        });
                      } else {
                        toast({
                          title: "Confirmation email sent! ✅",
                          description: "Please check your inbox for the confirmation link.",
                        });
                      }
                    } catch (err) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Failed to resend confirmation email.",
                      });
                    }
                  }}
                  className="bg-white border-gray-200 hover:bg-gray-50"
                >
                  Resend Email
                </Button>
              ),
            });
          }, 500);
        }
      } else {
        // Success
        toast({
          title: "Welcome back! 🎉",
          description: "You've successfully logged in.",
        });
        // Navigation will happen automatically via useEffect when session is set
      }
    } catch (err) {
      console.error("Unexpected login error:", err);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="w-screen h-screen flex items-center justify-center bg-white text-gray-900">Loading session...</div>;
  }

  if (session) {
    return null; // Or a loading spinner, while redirecting
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Welcome Back</h1>
          <p className="text-gray-600 mt-2">Log in to manage your salon bookings.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          <div className="space-y-2 relative">
            <Label htmlFor="password" className="text-gray-700">Password</Label>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full bg-[#008000] hover:bg-[#006600] text-lg py-6 text-white">
            {isSubmitting ? 'Logging in...' : <><LogIn className="mr-2" /> Log In</>}
          </Button>
        </form>

        <p className="text-center text-gray-600 mt-8">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-pink-600 hover:text-pink-700">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Login;