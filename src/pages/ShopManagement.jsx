
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { motion } from 'framer-motion';
import { Plus, MapPin, Trash2, Pencil, Save } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useShop } from '@/contexts/ShopContext';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import ImageUploader from '@/components/ImageUploader';

const ShopManagement = () => {
    const { toast } = useToast();
    const { shops, fetchShops, currentShop, setCurrentShop } = useShop();
    const { showDialog } = useAlertDialog();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingShop, setEditingShop] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        image_url: '',
        opening_time: '09:00',
        closing_time: '20:00'
    });

    // Ensure shops are fetched when component mounts
    useEffect(() => {
        fetchShops();
    }, [fetchShops]);

    const handleOpen = (shop = null) => {
        if (shop) {
            setEditingShop(shop);
            // Parse time values from database (format: HH:MM:SS) to input format (HH:MM)
            const openingTime = shop.opening_time ? shop.opening_time.substring(0, 5) : '09:00';
            const closingTime = shop.closing_time ? shop.closing_time.substring(0, 5) : '20:00';
            setFormData({
                name: shop.name,
                address: shop.address || '',
                phone: shop.phone || '',
                email: shop.email || '',
                image_url: shop.image_url || '',
                opening_time: openingTime,
                closing_time: closingTime
            });
        } else {
            setEditingShop(null);
            setFormData({
                name: '',
                address: '',
                phone: '',
                email: '',
                image_url: '',
                opening_time: '09:00',
                closing_time: '20:00'
            });
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.name.trim()) {
            return toast({ variant: 'destructive', title: 'Name is required' });
        }

        try {
            // Clean up form data - convert empty strings to null for optional fields
            // Convert time inputs (HH:MM) to TIME format (HH:MM:SS)
            const openingTime = formData.opening_time ? `${formData.opening_time}:00` : '09:00:00';
            const closingTime = formData.closing_time ? `${formData.closing_time}:00` : '20:00:00';

            const shopData = {
                name: formData.name.trim(),
                address: formData.address?.trim() || null,
                phone: formData.phone?.trim() || null,
                email: formData.email?.trim() || null,
                image_url: formData.image_url?.trim() || null,
                opening_time: openingTime,
                closing_time: closingTime,
            };

            if (editingShop) {
                const { data, error } = await supabase
                    .from('shops')
                    .update(shopData)
                    .eq('id', editingShop.id)
                    .select();

                if (error) {
                    console.error('Error updating shop:', error);
                    throw error;
                }
                console.log('Shop updated successfully:', data);
                toast({ title: 'Shop updated successfully' });
            } else {
                const { data, error } = await supabase
                    .from('shops')
                    .insert([shopData])
                    .select();

                if (error) {
                    console.error('Error creating shop:', error);
                    throw error;
                }
                console.log('Shop created successfully:', data);
                toast({ title: 'Shop created successfully' });
            }
            fetchShops();
            setIsDialogOpen(false);
            // Reset form
            setFormData({
                name: '',
                address: '',
                phone: '',
                email: '',
                image_url: '',
                opening_time: '09:00',
                closing_time: '20:00'
            });
        } catch (error) {
            console.error('Full error details:', error);
            toast({
                variant: 'destructive',
                title: 'Error saving shop',
                description: error.message || 'Failed to save shop. Please check console for details.'
            });
        }
    };

    const handleDelete = async (shop) => {
        // Check for related data before deletion
        const [appointmentsResult, teamMembersResult] = await Promise.all([
            supabase.from('appointments').select('id').eq('shop_id', shop.id).limit(1),
            supabase.from('team_member_shops').select('id').eq('shop_id', shop.id).limit(1)
        ]);

        const hasAppointments = appointmentsResult.data && appointmentsResult.data.length > 0;
        const hasTeamMembers = teamMembersResult.data && teamMembersResult.data.length > 0;

        let warningMessage = `Are you sure you want to delete "${shop.name}"?`;
        if (hasAppointments || hasTeamMembers) {
            warningMessage += '\n\nThis will also delete:';
            if (hasAppointments) {
                const { count } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id);
                warningMessage += `\n• ${count || 0} appointment(s)`;
            }
            if (hasTeamMembers) {
                const { count } = await supabase.from('team_member_shops').select('*', { count: 'exact', head: true }).eq('shop_id', shop.id);
                warningMessage += `\n• Team member assignments`;
            }
            warningMessage += '\n\nThis action cannot be undone.';
        }

        showDialog({
            title: 'Delete Shop',
            description: warningMessage,
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from('shops').delete().eq('id', shop.id);
                    if (error) {
                        toast({ variant: 'destructive', title: 'Error deleting shop', description: error.message });
                        return;
                    }

                    // If the deleted shop was the current shop, reset current shop selection
                    if (currentShop && currentShop.id === shop.id) {
                        setCurrentShop(null);
                    }

                    toast({ title: 'Shop deleted successfully', description: `"${shop.name}" has been removed.` });
                    fetchShops();
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Error deleting shop', description: error.message });
                }
            }
        });
    };

    return (
        <Layout>
            <Helmet><title>Shop Management</title></Helmet>
            <div className="p-4 md:p-8 pt-12 pb-24 max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Shops</h1>
                    <Button onClick={() => handleOpen()} className="bg-[#008000] hover:bg-[#006600] text-white">
                        <Plus className="mr-2 h-4 w-4" /> Add Shop
                    </Button>
                </div>

                {shops.length === 0 ? (
                    <div className="text-center py-20">
                        <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                        <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Shops Found</h2>
                        <p className="text-gray-600 mb-6">Get started by adding your first shop location.</p>
                        <Button onClick={() => handleOpen()} className="bg-[#008000] hover:bg-[#006600] text-white">
                            <Plus className="mr-2 h-4 w-4" /> Add Your First Shop
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {shops.map((shop) => (
                            <motion.div
                                key={shop.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="h-40 bg-gray-100 relative">
                                    {shop.image_url ? (
                                        <img
                                            src={shop.image_url}
                                            alt={shop.name}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                // Hide broken image and show placeholder
                                                e.target.style.display = 'none';
                                                const placeholder = e.target.nextElementSibling;
                                                if (placeholder && placeholder.classList.contains('placeholder-icon')) {
                                                    placeholder.style.display = 'flex';
                                                }
                                            }}
                                        />
                                    ) : null}
                                    <div className={`flex items-center justify-center h-full text-gray-400 ${shop.image_url ? 'hidden placeholder-icon' : ''}`}>
                                        <MapPin className="h-10 w-10" />
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h3 className="text-xl font-semibold text-gray-900 mb-1">{shop.name}</h3>
                                    {shop.address && (
                                        <p className="text-gray-600 text-sm mb-2">{shop.address}</p>
                                    )}
                                    {shop.phone && (
                                        <p className="text-gray-500 text-xs mb-1">📞 {shop.phone}</p>
                                    )}
                                    {shop.email && (
                                        <p className="text-gray-500 text-xs mb-4">✉️ {shop.email}</p>
                                    )}
                                    <div className="flex justify-end gap-2 mt-4">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpen(shop)}
                                            className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                            title="Edit shop"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleDelete(shop)}
                                            className="bg-red-500 hover:bg-red-600 text-white"
                                            title="Delete shop"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="bg-white border-gray-200 text-gray-900">
                        <DialogHeader>
                            <DialogTitle>{editingShop ? 'Edit Shop' : 'Add New Shop'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="flex justify-center mb-4">
                                <div className="w-full max-w-[200px]">
                                    <Label>Shop Image</Label>
                                    <ImageUploader initialImageUrl={formData.image_url} onUploadSuccess={(url) => setFormData({ ...formData, image_url: url })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Shop Name</Label>
                                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-white border-gray-200 text-gray-700" />
                            </div>
                            <div className="space-y-2">
                                <Label>Address</Label>
                                <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="bg-white border-gray-200 text-gray-700" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Phone</Label>
                                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="bg-white border-gray-200 text-gray-700" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="bg-white border-gray-200 text-gray-700" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Opening Time <span className="text-gray-500 font-normal">(Optional)</span></Label>
                                    <Input
                                        type="time"
                                        value={formData.opening_time}
                                        onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                                        className="bg-white border-gray-200 text-gray-700"
                                        placeholder="09:00"
                                    />
                                    <p className="text-xs text-gray-500">When the shop opens each day. Default: 09:00</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Closing Time <span className="text-gray-500 font-normal">(Optional)</span></Label>
                                    <Input
                                        type="time"
                                        value={formData.closing_time}
                                        onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
                                        className="bg-white border-gray-200 text-gray-700"
                                        placeholder="20:00"
                                    />
                                    <p className="text-xs text-gray-500">When the shop closes each day. Default: 20:00</p>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleSave} className="bg-pink-600 hover:bg-pink-700"><Save className="mr-2 h-4 w-4" /> Save Shop</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </Layout>
    );
};

export default ShopManagement;
