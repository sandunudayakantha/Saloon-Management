
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Calendar as CalendarIcon, DollarSign, ArrowUpRight, ArrowDownRight, Plus, Save, Loader2, Trash2, Pencil, Clock, Tag } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useShop } from '@/contexts/ShopContext';
import { supabase } from '@/lib/customSupabaseClient';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import { MapPin, Building2 } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format as fnsFormat } from "date-fns"; // Rename to avoid conflict if format is used elsewhere or just usage clarity

const StatCard = ({ title, value, icon: Icon, trend, trendValue }) => (
    <Card className="bg-white border-gray-200 text-gray-900 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
            <Icon className="h-4 w-4 text-[#008000]" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {trend && (
                <p className={`text-xs flex items-center mt-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {trend === 'up' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                    {trendValue} from last month
                </p>
            )}
        </CardContent>
    </Card>
);

const Market = () => {
    const { currentShop, setCurrentShop, shops, fetchShops } = useShop();
    const { toast } = useToast();
    const { showDialog } = useAlertDialog();

    // Analytics State
    const [analytics, setAnalytics] = useState({
        totalRevenue: 0,
        totalBookings: 0,
        topService: 'N/A',
        topStaff: 'N/A'
    });
    const [staffPerformance, setStaffPerformance] = useState([]);

    // Offers State
    const [offers, setOffers] = useState([]);
    const [services, setServices] = useState([]); // For service selection in offers
    const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
    const [isSavingOffer, setIsSavingOffer] = useState(false);
    const [offerFormData, setOfferFormData] = useState({
        title: '',
        description: '',
        service_id: 'all', // 'all' or specific service UUID
        discount_percentage: '',
        start_date: '',
        end_date: ''
    });

    // Shop State
    const [loading, setLoading] = useState(false);
    const [isAddShopDialogOpen, setIsAddShopDialogOpen] = useState(false);
    const [isSavingShop, setIsSavingShop] = useState(false);
    const [shopFormData, setShopFormData] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        opening_time: '09:00',
        closing_time: '20:00'
    });
    const [editingShop, setEditingShop] = useState(null);

    useEffect(() => {
        if (currentShop) {
            fetchAnalytics();
            fetchOffers();
            fetchServices();
        } else {
            setOffers([]);
            setServices([]);
        }
    }, [currentShop]);

    const fetchServices = async () => {
        if (!currentShop) return;
        const { data } = await supabase
            .from('services')
            .select('id, name')
            .eq('shop_id', currentShop.id)
            .order('name');
        setServices(data || []);
    };

    const fetchOffers = async () => {
        if (!currentShop) return;
        const { data, error } = await supabase
            .from('offers')
            .select(`
                *,
                services (name, price, duration)
            `)
            .eq('shop_id', currentShop.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching offers:', error);
        } else {
            setOffers(data || []);
        }
    };

    const fetchAnalytics = async () => {
        setLoading(true);
        const start = startOfMonth(new Date());
        const end = endOfMonth(new Date());

        const { data: appts } = await supabase
            .from('appointments')
            .select(`
                price, 
                service_id, 
                team_member_id,
                team_members(name),
                services(name)
            `)
            .eq('shop_id', currentShop.id)
            .gte('start_time', start.toISOString())
            .lte('end_time', end.toISOString());

        if (appts) {
            const totalRevenue = appts.reduce((sum, a) => sum + (a.price || 0), 0);

            // Staff Aggregation
            const staffMap = {};
            appts.forEach(a => {
                const name = a.team_members?.name || 'Unknown';
                staffMap[name] = (staffMap[name] || 0) + (a.price || 0);
            });

            const sortedStaff = Object.entries(staffMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

            setStaffPerformance(sortedStaff);

            setAnalytics({
                totalRevenue,
                totalBookings: appts.length,
                topService: appts.length > 0 ? (appts[0].services?.name || 'N/A') : 'N/A',
                topStaff: sortedStaff.length > 0 ? sortedStaff[0].name : 'N/A'
            });
        }
        setLoading(false);
    };

    // --- Offer Handlers ---

    const handleCreateOffer = async () => {
        if (!offerFormData.title.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Offer title is required.' });
            return;
        }

        setIsSavingOffer(true);
        try {
            const newOffer = {
                title: offerFormData.title.trim(),
                description: offerFormData.description.trim(),
                shop_id: currentShop.id,
                service_id: offerFormData.service_id === 'all' ? null : offerFormData.service_id,
                discount_percentage: offerFormData.discount_percentage ? parseFloat(offerFormData.discount_percentage) : null,
                start_date: offerFormData.start_date ? new Date(offerFormData.start_date).toISOString() : null,
                end_date: offerFormData.end_date ? new Date(offerFormData.end_date).toISOString() : null
            };

            const { error } = await supabase.from('offers').insert([newOffer]);

            if (error) throw error;

            toast({ title: 'Success', description: 'Offer created successfully.' });
            setIsOfferDialogOpen(false);
            setOfferFormData({
                title: '',
                description: '',
                service_id: 'all',
                discount_percentage: '',
                start_date: '',
                end_date: ''
            });
            fetchOffers();
        } catch (error) {
            console.error('Error creating offer:', error);
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSavingOffer(false);
        }
    };

    const handleDeleteOffer = async (id) => {
        showDialog({
            title: 'Delete Offer?',
            description: 'Are you sure you want to delete this offer? This cannot be undone.',
            confirmText: 'Delete',
            onConfirm: async () => {
                const { error } = await supabase.from('offers').delete().eq('id', id);
                if (error) {
                    toast({ variant: 'destructive', title: 'Error', description: error.message });
                } else {
                    toast({ title: 'Deleted', description: 'Offer removed.' });
                    fetchOffers();
                }
            }
        });
    };

    // --- Shop Handlers ---

    const handleAddShop = () => {
        setEditingShop(null);
        setShopFormData({
            name: '',
            address: '',
            phone: '',
            email: '',
            opening_time: '09:00',
            closing_time: '20:00'
        });
        setIsAddShopDialogOpen(true);
    };

    const handleEditShop = (shop) => {
        setEditingShop(shop);
        // Parse time values from database (format: HH:MM:SS) to input format (HH:MM)
        const openingTime = shop.opening_time ? shop.opening_time.substring(0, 5) : '09:00';
        const closingTime = shop.closing_time ? shop.closing_time.substring(0, 5) : '20:00';
        setShopFormData({
            name: shop.name,
            address: shop.address || '',
            phone: shop.phone || '',
            email: shop.email || '',
            opening_time: openingTime,
            closing_time: closingTime
        });
        setIsAddShopDialogOpen(true);
    };

    const handleSaveShop = async () => {
        if (!shopFormData.name.trim()) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Shop name is required.'
            });
            return;
        }

        setIsSavingShop(true);
        try {
            // Convert time inputs (HH:MM) to TIME format (HH:MM:SS)
            const openingTime = shopFormData.opening_time ? `${shopFormData.opening_time}:00` : '09:00:00';
            const closingTime = shopFormData.closing_time ? `${shopFormData.closing_time}:00` : '20:00:00';

            const payload = {
                name: shopFormData.name.trim(),
                address: shopFormData.address?.trim() || null,
                phone: shopFormData.phone?.trim() || null,
                email: shopFormData.email?.trim() || null,
                opening_time: openingTime,
                closing_time: closingTime
            };

            let data, error;
            if (editingShop) {
                const result = await supabase
                    .from('shops')
                    .update(payload)
                    .eq('id', editingShop.id)
                    .select();
                data = result.data;
                error = result.error;
            } else {
                const result = await supabase
                    .from('shops')
                    .insert([payload])
                    .select();
                data = result.data;
                error = result.error;
            }

            if (error) {
                console.error('Error saving shop:', error);
                throw error;
            }

            console.log(editingShop ? 'Shop updated successfully:' : 'Shop created successfully:', data);
            toast({
                title: 'Success!',
                description: `Shop "${shopFormData.name}" has been ${editingShop ? 'updated' : 'created'} successfully.`
            });

            setIsAddShopDialogOpen(false);
            setEditingShop(null);
            setShopFormData({
                name: '',
                address: '',
                phone: '',
                email: '',
                opening_time: '09:00',
                closing_time: '20:00'
            });
            fetchShops();
        } catch (error) {
            console.error('Full error details:', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: error.message || 'Failed to create shop. Please check console for details.'
            });
        } finally {
            setIsSavingShop(false);
        }
    };

    const handleDeleteShop = async (shop) => {
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
            <Helmet><title>Marketing & Analytics</title></Helmet>
            <div className="p-4 md:p-8 pt-12 pb-24 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Marketing Center</h1>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-[#008000]" />
                                <p className="text-gray-600">Select shop to view analytics:</p>
                            </div>
                            <Select
                                value={currentShop?.id?.toString() || ''}
                                onValueChange={(value) => {
                                    const selectedShop = shops.find(s => s.id.toString() === value);
                                    if (selectedShop) {
                                        setCurrentShop(selectedShop);
                                    }
                                }}
                            >
                                <SelectTrigger className="w-[250px] bg-white border-gray-300 text-gray-900">
                                    <SelectValue placeholder="Select a shop">
                                        {currentShop ? (
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-[#008000]" />
                                                <span>{currentShop.name}</span>
                                            </div>
                                        ) : (
                                            'Select a shop'
                                        )}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200">
                                    {shops.map((shop) => (
                                        <SelectItem key={shop.id} value={shop.id.toString()} className="text-gray-900">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-[#008000]" />
                                                <span>{shop.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {currentShop && (
                            <div className="mt-3 flex items-center gap-2 text-sm">
                                <div className="px-3 py-1.5 bg-[#008000]/10 border border-[#008000]/20 rounded-lg flex-1">
                                    <span className="text-gray-700">Showing data for: </span>
                                    <span className="text-[#008000] font-semibold">{currentShop.name}</span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditShop(currentShop)}
                                    className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                    title="Edit shop"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {currentShop && (
                            <Button
                                onClick={() => handleDeleteShop(currentShop)}
                                variant="destructive"
                                className="bg-red-500 hover:bg-red-600 text-white"
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Salon
                            </Button>
                        )}
                        <Button
                            onClick={handleAddShop}
                            className="bg-[#008000] hover:bg-[#006600] text-white"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Add Salon
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="analytics" className="space-y-6">
                    <TabsList className="bg-gray-100 border border-gray-200">
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white text-gray-700">Analytics</TabsTrigger>
                        <TabsTrigger value="campaigns" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white text-gray-700">Offers & Campaigns</TabsTrigger>
                    </TabsList>

                    <TabsContent value="analytics" className="space-y-6">
                        {!currentShop ? (
                            <Card className="bg-white border-gray-200 text-gray-900">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Building2 className="w-16 h-16 text-gray-400 mb-4" />
                                    <h3 className="text-xl font-semibold mb-2 text-gray-900">No Shop Selected</h3>
                                    <p className="text-gray-600 text-center max-w-md mb-6">Please select a shop from the dropdown above to view analytics and performance data.</p>
                                </CardContent>
                            </Card>
                        ) : loading ? (
                            <Card className="bg-white border-gray-200 text-gray-900">
                                <CardContent className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-[#008000] mb-4" />
                                    <p className="text-gray-600">Loading analytics for {currentShop.name}...</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                {/* KPI Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard title="Total Revenue (Mo)" value={`$${analytics.totalRevenue.toLocaleString()}`} icon={DollarSign} trend="up" trendValue="12%" />
                                    <StatCard title="Total Bookings" value={analytics.totalBookings} icon={CalendarIcon} trend="up" trendValue="5%" />
                                    <StatCard title="Top Stylist" value={analytics.topStaff} icon={Users} />
                                    <StatCard title="Top Service" value={analytics.topService} icon={TrendingUp} />
                                </div>

                                {/* Detailed Performance */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Card className="bg-white border-gray-200 text-gray-900">
                                        <CardHeader><CardTitle>Revenue by Staff</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {staffPerformance.map((staff, idx) => (
                                                    <div key={idx} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-[#008000]/20 flex items-center justify-center text-[#008000] font-bold text-xs">
                                                                {staff.name.charAt(0)}
                                                            </div>
                                                            <span className="font-medium">{staff.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 w-1/2">
                                                            <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-[#008000]"
                                                                    style={{ width: `${(staff.value / analytics.totalRevenue) * 100}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-sm font-mono w-16 text-right">${staff.value}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {staffPerformance.length === 0 && <p className="text-gray-500 text-center py-4">No data for this month.</p>}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="bg-white border-gray-200 text-gray-900">
                                        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                {/* Placeholder logic for now */}
                                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                    <p className="text-sm text-gray-700">Revenue target reached for <span className="text-gray-900 font-bold">{currentShop?.name}</span>!</p>
                                                    <p className="text-xs text-gray-500 mt-1">Today</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="campaigns">
                        <Card className="bg-white border-gray-200 text-gray-900">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-xl">Active Offers & Campaigns</CardTitle>
                                {currentShop && (
                                    <Button onClick={() => setIsOfferDialogOpen(true)} className="bg-[#008000] hover:bg-[#006600] text-white">
                                        <Plus className="mr-2 h-4 w-4" /> Create Offer
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent>
                                {!currentShop ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <p className="text-gray-600">Please select a shop to view its offers.</p>
                                    </div>
                                ) : offers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="w-16 h-16 bg-[#008000]/10 rounded-full flex items-center justify-center mb-4">
                                            <TrendingUp className="w-8 h-8 text-[#008000]" />
                                        </div>
                                        <h3 className="text-xl font-semibold mb-2">No Active Offers</h3>
                                        <p className="text-gray-600 max-w-md mb-6">Create your first marketing offer to attract more customers.</p>
                                        <Button onClick={() => setIsOfferDialogOpen(true)} variant="outline" className="border-[#008000] text-[#008000] hover:bg-[#008000]/10">
                                            Create First Offer
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {offers.map(offer => {
                                            const originalPrice = offer.services?.price || 0;
                                            const discount = offer.discount_percentage || 0;
                                            const discountedPrice = originalPrice - (originalPrice * (discount / 100));

                                            return (
                                                <Card key={offer.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <h4 className="font-bold text-lg text-gray-900">{offer.title}</h4>
                                                                </div>
                                                                <p className="text-sm text-gray-600 mb-3">{offer.description}</p>

                                                                <div className="flex flex-wrap items-center gap-3">
                                                                    {/* Service Tag */}
                                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium border border-blue-100">
                                                                        <span>{offer.services ? offer.services.name : 'All Services'}</span>
                                                                    </div>

                                                                    {/* Duration Tag */}
                                                                    {offer.services?.duration && (
                                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 text-gray-600 text-xs rounded-md font-medium border border-gray-100">
                                                                            <Clock className="w-3 h-3" />
                                                                            <span>{offer.services.duration} min</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Discount Tag */}
                                                                    {offer.discount_percentage && (
                                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs rounded-md font-medium border border-green-100">
                                                                            <Tag className="w-3 h-3" />
                                                                            <span>{offer.discount_percentage}% OFF</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Price Calculation Section */}
                                                                {offer.services && offer.discount_percentage && (
                                                                    <div className="mt-3 flex items-baseline gap-2">
                                                                        <span className="text-lg font-bold text-[#008000]">
                                                                            ${discountedPrice.toFixed(2)}
                                                                        </span>
                                                                        <span className="text-sm text-gray-400 line-through">
                                                                            ${originalPrice.toFixed(0)}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {offer.end_date && (
                                                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                                        <CalendarIcon className="w-3 h-3" />
                                                                        Valid until: {format(new Date(offer.end_date), 'MMM dd, yyyy')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 -mr-2 -mt-2"
                                                                onClick={() => handleDeleteOffer(offer.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Create Offer Dialog */}
            <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
                <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create New Offer</DialogTitle>
                        <DialogDescription>Create a promotional offer for your customers.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Offer Title</Label>
                            <Input
                                placeholder="e.g., Summer Haircut Sale"
                                value={offerFormData.title}
                                onChange={e => setOfferFormData({ ...offerFormData, title: e.target.value })}
                                className="bg-white border-gray-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                placeholder="e.g., Get 20% off on all haircuts this week!"
                                value={offerFormData.description}
                                onChange={e => setOfferFormData({ ...offerFormData, description: e.target.value })}
                                className="bg-white border-gray-200"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Service</Label>
                                <Select
                                    value={offerFormData.service_id}
                                    onValueChange={val => setOfferFormData({ ...offerFormData, service_id: val })}
                                >
                                    <SelectTrigger className="bg-white border-gray-200">
                                        <SelectValue placeholder="Select Service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Services</SelectItem>
                                        {services.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Discount (%)</Label>
                                <Input
                                    type="number"
                                    placeholder="20"
                                    value={offerFormData.discount_percentage}
                                    onChange={e => setOfferFormData({ ...offerFormData, discount_percentage: e.target.value })}
                                    className="bg-white border-gray-200"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-white border-gray-200",
                                                !offerFormData.start_date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {offerFormData.start_date ? fnsFormat(new Date(offerFormData.start_date), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={offerFormData.start_date ? new Date(offerFormData.start_date) : undefined}
                                            onSelect={(date) => setOfferFormData({ ...offerFormData, start_date: date ? date.toISOString() : '' })}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal bg-white border-gray-200",
                                                !offerFormData.end_date && "text-muted-foreground"
                                            )}
                                        >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            {offerFormData.end_date ? fnsFormat(new Date(offerFormData.end_date), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={offerFormData.end_date ? new Date(offerFormData.end_date) : undefined}
                                            onSelect={(date) => setOfferFormData({ ...offerFormData, end_date: date ? date.toISOString() : '' })}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsOfferDialogOpen(false)} className="h-10 px-4">Cancel</Button>
                        <Button
                            className="bg-[#008000] hover:bg-[#006600] text-white h-10 px-8"
                            onClick={handleCreateOffer}
                            disabled={isSavingOffer}
                        >
                            {isSavingOffer ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Offer'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Shop Dialog */}
            <Dialog open={isAddShopDialogOpen} onOpenChange={setIsAddShopDialogOpen}>
                <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{editingShop ? 'Edit Salon' : 'Add New Salon'}</DialogTitle>
                        <DialogDescription>
                            {editingShop ? 'Update the salon details below.' : 'Create a new salon location. Name is required.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="shop-name">Salon Name *</Label>
                            <Input
                                id="shop-name"
                                value={shopFormData.name}
                                onChange={(e) => setShopFormData({ ...shopFormData, name: e.target.value })}
                                placeholder="Enter salon name"
                                className="bg-white border-gray-200 text-gray-700"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="shop-address">Address (Optional)</Label>
                            <Input
                                id="shop-address"
                                value={shopFormData.address}
                                onChange={(e) => setShopFormData({ ...shopFormData, address: e.target.value })}
                                placeholder="Enter salon address"
                                className="bg-white border-gray-200 text-gray-700"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="shop-phone">Phone (Optional)</Label>
                                <Input
                                    id="shop-phone"
                                    value={shopFormData.phone}
                                    onChange={(e) => setShopFormData({ ...shopFormData, phone: e.target.value })}
                                    placeholder="Phone number"
                                    className="bg-white border-gray-200 text-gray-700"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="shop-email">Email (Optional)</Label>
                                <Input
                                    id="shop-email"
                                    type="email"
                                    value={shopFormData.email}
                                    onChange={(e) => setShopFormData({ ...shopFormData, email: e.target.value })}
                                    placeholder="Email address"
                                    className="bg-white border-gray-200 text-gray-700"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="shop-opening-time">Opening Time <span className="text-gray-500 font-normal">(Optional)</span></Label>
                                <Input
                                    id="shop-opening-time"
                                    type="time"
                                    value={shopFormData.opening_time}
                                    onChange={(e) => setShopFormData({ ...shopFormData, opening_time: e.target.value })}
                                    placeholder="09:00"
                                    className="bg-white border-gray-200 text-gray-700"
                                />
                                <p className="text-xs text-gray-500">When the shop opens each day. Default: 09:00</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="shop-closing-time">Closing Time <span className="text-gray-500 font-normal">(Optional)</span></Label>
                                <Input
                                    id="shop-closing-time"
                                    type="time"
                                    value={shopFormData.closing_time}
                                    onChange={(e) => setShopFormData({ ...shopFormData, closing_time: e.target.value })}
                                    placeholder="20:00"
                                    className="bg-white border-gray-200 text-gray-700"
                                />
                                <p className="text-xs text-gray-500">When the shop closes each day. Default: 20:00</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsAddShopDialogOpen(false);
                                setEditingShop(null);
                                setShopFormData({
                                    name: '',
                                    address: '',
                                    phone: '',
                                    email: '',
                                    opening_time: '09:00',
                                    closing_time: '20:00'
                                });
                            }}
                            disabled={isSavingShop}
                            className="border-gray-200"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveShop}
                            disabled={isSavingShop || !shopFormData.name.trim()}
                            className="bg-[#008000] hover:bg-[#006600] text-white disabled:opacity-50"
                        >
                            {isSavingShop ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {editingShop ? 'Updating...' : 'Creating...'}
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    {editingShop ? 'Update Salon' : 'Create Salon'}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Layout>
    );
};

export default Market;
