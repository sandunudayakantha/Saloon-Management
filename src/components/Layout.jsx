
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Users, UserCircle, LogOut, Search, Briefcase, Settings, Store, ShieldCheck, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useShop } from '@/contexts/ShopContext';
import { useToast } from '@/components/ui/use-toast';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { currentShop } = useShop();
  const { toast } = useToast();
  const [openSearch, setOpenSearch] = useState(false);
  const [clients, setClients] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('staff');

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.email) return;
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('role')
          .eq('email', user.email)
          .limit(1);

        if (data && data.length > 0) {
          setCurrentUserRole(data[0].role);
        }
        // Silently handle errors (user not found is expected)
      } catch (err) {
        // Ignore errors - user not in team_members is expected
      }
    };
    fetchUserRole();
  }, [user]);

  const navItems = [
    { icon: Calendar, label: 'Calendar', path: '/calendar' },
    { icon: Users, label: 'Team', path: '/team' },
    { icon: UserCircle, label: 'Clients', path: '/clients' },
    { icon: Briefcase, label: 'Services', path: '/services' },
    { icon: Store, label: 'Marketing', path: '/market' },
  ];

  const fetchClientsForSearch = useCallback(async () => {
    if (!currentShop) {
      setClients([]);
      return;
    }
    const { data, error } = await supabase.from('clients').select('id, name').eq('shop_id', currentShop.id).limit(5);
    if (error) {
      toast({ title: '🚧 Could not fetch clients', description: error.message, variant: 'destructive' });
    } else {
      setClients(data || []);
    }
  }, [toast, currentShop]);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenSearch((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (openSearch) fetchClientsForSearch();
  }, [openSearch, fetchClientsForSearch]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: "Logged out successfully! 👋", description: "See you next time!" });
    } catch (error) {
      console.error("Logout error:", error);
      // Even if server logout fails, we should let the user leave the UI
      toast({ title: "Logged out", description: "You have been logged out." });
    } finally {
      navigate('/login');
    }
  };

  const runCommand = (command) => {
    setOpenSearch(false);
    command();
  };

  // Hide settings and search buttons on calendar page
  const isCalendarPage = location.pathname === '/calendar';

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {!isCalendarPage && (
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm">
                <Settings className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 bg-white border-gray-200 text-gray-900 p-2 shadow-lg">
              <nav className="flex flex-col gap-1">
                {(currentUserRole === 'admin' || currentUserRole === 'owner') && (
                  <>
                    <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={() => navigate('/settings/admin')}>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Admin Dashboard
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={() => navigate('/settings/shops')}>
                      <MapPin className="mr-2 h-4 w-4" /> Shop Management
                    </Button>
                  </>
                )}
                <Button variant="ghost" className="w-full justify-start text-gray-700 hover:bg-gray-100" onClick={() => navigate('/settings/employment-status')}>Employment Statuses</Button>
              </nav>
            </PopoverContent>
          </Popover>
          <Button onClick={() => setOpenSearch(true)} variant="outline" size="icon" className="rounded-full bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm">
            <Search className="w-5 h-5" />
          </Button>
        </div>
      )}

      <main className="pb-24 bg-white">{children}</main>

      <CommandDialog open={openSearch} onOpenChange={setOpenSearch}>
        <CommandInput placeholder="Search for a client..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Clients">
            {clients.map((client) => (
              <CommandItem key={client.id} onSelect={() => runCommand(() => navigate(`/clients?highlight=${client.id}`))}>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>{client.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 bg-white backdrop-blur-lg border-t border-gray-200 z-40 shadow-lg"
      >
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-around py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <motion.button
                  key={item.path}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${isActive ? 'bg-[#008000] text-white shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{item.label}</span>
                </motion.button>
              );
            })}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-red-600 hover:text-red-700 transition-all"
            >
              <LogOut className="w-6 h-6" />
              <span className="text-xs font-medium">Logout</span>
            </motion.button>
          </div>
        </div>
      </motion.nav>
    </div>
  );
};

export default Layout;
