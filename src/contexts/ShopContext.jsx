
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const ShopContext = createContext();

export const ShopProvider = ({ children }) => {
  const [shops, setShops] = useState([]);
  const [currentShop, setCurrentShop] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchShops = async () => {
    try {
      console.log('ShopContext: Fetching shops...');
      const { data, error } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('ShopContext: Error fetching shops:', error);
        throw error;
      }

      const shopsData = data || [];
      console.log('ShopContext: Fetched shops:', shopsData.length, shopsData);
      setShops(shopsData);

      // Always auto-select the first shop if available
      if (shopsData.length > 0) {
        // Use functional update to check current state
        setCurrentShop(prevShop => {
          // If no shop selected, or current shop doesn't exist in new list, select first shop
          if (!prevShop || !shopsData.find(s => s.id === prevShop.id)) {
            console.log('ShopContext: Auto-selecting first shop:', shopsData[0].name, shopsData[0].id);
            return shopsData[0];
          }
          // Update current shop with fresh data if it still exists (important for opening/closing times)
          const updatedShop = shopsData.find(s => s.id === prevShop.id);
          if (updatedShop) {
            console.log('ShopContext: Updating current shop with fresh data:', updatedShop.name);
            return updatedShop;
          }
          // Keep current shop if it still exists but wasn't found (shouldn't happen)
          console.log('ShopContext: Keeping current shop:', prevShop.name);
          return prevShop;
        });
      } else {
        // No shops available
        console.log('ShopContext: No shops found');
        setCurrentShop(null);
      }
    } catch (error) {
      console.error('ShopContext: Error fetching shops:', error);
      setShops([]);
      setCurrentShop(null);
    } finally {
      setLoading(false);
      console.log('ShopContext: Loading complete');
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchShops();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('ShopContext: Auth event:', event);
      if (event === 'SIGNED_IN') {
        fetchShops();
      } else if (event === 'SIGNED_OUT') {
        setShops([]);
        setCurrentShop(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ShopContext.Provider value={{ shops, currentShop, setCurrentShop, fetchShops, loading }}>
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => useContext(ShopContext);
