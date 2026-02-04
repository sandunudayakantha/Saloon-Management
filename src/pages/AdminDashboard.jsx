
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { motion } from 'framer-motion';
import { Shield, Store, Save, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';

const AdminDashboard = () => {
    const { userRole, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [staff, setStaff] = useState([]);
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);

    // Fetch all data needed
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Shops
                const { data: shopsData, error: shopsError } = await supabase.from('shops').select('*');
                if (shopsError) throw shopsError;
                setShops(shopsData);

                // 2. Fetch Staff & their current shop assignments
                const { data: staffData, error: staffError } = await supabase
                    .from('team_members')
                    .select(`
                        id, 
                        name, 
                        email, 
                        role, 
                        image_url,
                        employment_statuses(status_name),
                        team_member_shops(shop_id)
                    `)
                    .order('name');
                
                if (staffError) throw staffError;

                // Transform data to include array of shop_ids for easy checking
                const transformedStaff = staffData.map(member => ({
                    ...member,
                    shop_ids: member.team_member_shops.map(tms => tms.shop_id)
                }));

                setStaff(transformedStaff);

            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error fetching data', description: error.message });
            } finally {
                setLoading(false);
            }
        };

        if (userRole === 'owner' || userRole === 'admin') {
            fetchData();
        }
    }, [userRole, toast]);

    const handleRoleChange = async (memberId, newRole) => {
        setSavingId(memberId);
        try {
            const { error } = await supabase
                .from('team_members')
                .update({ role: newRole })
                .eq('id', memberId);

            if (error) throw error;

            setStaff(prev => prev.map(p => p.id === memberId ? { ...p, role: newRole } : p));
            toast({ title: 'Role updated', description: 'User permissions have been changed.' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update failed', description: error.message });
        } finally {
            setSavingId(null);
        }
    };

    const handleShopAssignment = async (memberId, shopId, isChecked) => {
        // Optimistic update
        setStaff(prev => prev.map(member => {
            if (member.id === memberId) {
                const newShops = isChecked 
                    ? [...member.shop_ids, shopId]
                    : member.shop_ids.filter(id => id !== shopId);
                return { ...member, shop_ids: newShops };
            }
            return member;
        }));

        try {
            if (isChecked) {
                const { error } = await supabase
                    .from('team_member_shops')
                    .insert({ team_member_id: memberId, shop_id: shopId });
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('team_member_shops')
                    .delete()
                    .eq('team_member_id', memberId)
                    .eq('shop_id', shopId);
                if (error) throw error;
            }
        } catch (error) {
            // Revert on error (simplified for now, usually would re-fetch)
            toast({ variant: 'destructive', title: 'Assignment failed', description: error.message });
        }
    };

    if (authLoading) return null;
    if (userRole !== 'owner' && userRole !== 'admin') {
        return <Navigate to="/" />;
    }

    return (
        <Layout>
            <Helmet><title>Admin Dashboard</title></Helmet>
            <div className="p-4 md:p-8 pt-12 pb-24 max-w-7xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-pink-600 rounded-xl shadow-lg shadow-pink-900/20">
                        <Shield className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                        <p className="text-gray-600">Manage roles, permissions, and shop assignments.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-pink-600" /></div>
                ) : (
                    <div className="grid gap-6">
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-gray-200">
                                <h2 className="text-xl font-semibold text-gray-900">Team Permissions</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-gray-600 text-sm">
                                        <tr>
                                            <th className="p-4">Team Member</th>
                                            <th className="p-4">System Role</th>
                                            <th className="p-4">Shop Access</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-gray-700">
                                        {staff.map((member) => (
                                            <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <img 
                                                            src={member.image_url || `https://ui-avatars.com/api/?name=${member.name}&background=random`} 
                                                            alt={member.name} 
                                                            className="w-10 h-10 rounded-full object-cover border border-gray-200" 
                                                            onError={(e) => {
                                                                // Fallback to avatar API if image fails to load
                                                                const fallbackUrl = `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}&background=008000&color=ffffff&size=128`;
                                                                if (e.target.src !== fallbackUrl) {
                                                                    e.target.src = fallbackUrl;
                                                                } else {
                                                                    // If avatar API also fails, hide broken image
                                                                    e.target.style.display = 'none';
                                                                }
                                                            }}
                                                        />
                                                        <div>
                                                            <div className="font-medium text-gray-900">{member.name}</div>
                                                            <div className="text-xs text-gray-500">{member.email || 'No email'}</div>
                                                            <Badge variant="outline" className="mt-1 text-xs border-gray-200 text-gray-600">
                                                                {member.employment_statuses?.status_name || 'No Status'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="w-40">
                                                        <Select 
                                                            value={member.role || 'staff'} 
                                                            onValueChange={(val) => handleRoleChange(member.id, val)}
                                                            disabled={savingId === member.id}
                                                        >
                                                            <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-white border-gray-200 text-gray-900">
                                                                <SelectItem value="staff">Staff</SelectItem>
                                                                <SelectItem value="admin">Admin</SelectItem>
                                                                <SelectItem value="owner">Owner</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-wrap gap-3">
                                                        {shops.map(shop => {
                                                            const isAssigned = member.shop_ids.includes(shop.id);
                                                            return (
                                                                <div key={shop.id} className="flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                                                                    <Checkbox 
                                                                        id={`shop-${member.id}-${shop.id}`}
                                                                        checked={isAssigned}
                                                                        onCheckedChange={(checked) => handleShopAssignment(member.id, shop.id, checked)}
                                                                        className="border-gray-300 data-[state=checked]:bg-pink-600 data-[state=checked]:border-pink-600"
                                                                    />
                                                                    <label 
                                                                        htmlFor={`shop-${member.id}-${shop.id}`}
                                                                        className="text-sm cursor-pointer select-none text-gray-700"
                                                                    >
                                                                        {shop.name}
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                        {shops.length === 0 && <span className="text-gray-500 italic">No shops created yet.</span>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default AdminDashboard;
