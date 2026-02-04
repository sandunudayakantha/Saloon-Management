import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e) => {
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

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await signUp(email, password);
      
      if (error) {
        console.error("Signup error:", error);
        let errorMessage = "Failed to create account. Please try again.";
        
        // Handle specific Supabase errors
        if (error.message.includes("already registered")) {
          errorMessage = "This email is already registered. Please log in instead.";
        } else if (error.message.includes("invalid email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (error.message.includes("password")) {
          errorMessage = "Password does not meet requirements. Please use a stronger password.";
        } else {
          errorMessage = error.message || errorMessage;
        }
        
        toast({
          variant: "destructive",
          title: "Sign Up Failed",
          description: errorMessage,
        });
      } else {
        // Success - check if email confirmation is required
        if (data?.user && !data?.session) {
          // Email confirmation required
          toast({
            title: "Account created! 🎉",
            description: "Please check your email to verify your account before logging in.",
          });
        } else if (data?.session) {
          // Auto-logged in (if email confirmation is disabled)
          toast({
            title: "Account created! 🎉",
            description: "Welcome! You have been logged in.",
          });
        } else {
      toast({
        title: "Account created! 🎉",
        description: "Please check your email to verify your account.",
      });
        }
        
      navigate('/login');
      }
    } catch (err) {
      console.error("Unexpected signup error:", err);
      toast({
        variant: "destructive",
        title: "Sign Up Failed",
        description: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Create an Account</h1>
          <p className="text-gray-600 mt-2">Join us and start managing your salon.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-6">
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
              minLength={6}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            {password && password.length > 0 && password.length < 6 && (
              <p className="text-xs text-amber-600 mt-1">
                Password must be at least 6 characters long
              </p>
            )}
          </div>

          <Button type="submit" disabled={isLoading} className="w-full bg-[#008000] hover:bg-[#006600] text-lg py-6 text-white">
            {isLoading ? 'Creating Account...' : <><UserPlus className="mr-2" /> Sign Up</>}
          </Button>
        </form>

        <p className="text-center text-gray-600 mt-8">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-pink-600 hover:text-pink-700">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;