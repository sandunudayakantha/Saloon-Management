import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Save, X, Loader2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Layout from '@/components/Layout';
import { useToast } from '@/components/ui/use-toast';
import ImageUploader from '@/components/ImageUploader';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/lib/customSupabaseClient';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import { useShop } from '@/contexts/ShopContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, User, Globe, Calendar, Building2, MapPin, Clock, User as UserIcon, Calendar as CalendarIcon } from 'lucide-react';
import { format, parseISO, isToday, isFuture, startOfDay } from 'date-fns';
import { utils, writeFile, read } from 'xlsx';

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const initialFormState = { 
  name: '', email: '', phone: '', employment_status_id: null, image_url: '', working_days: [], services: [],
  // Public Profile fields
  job_title: '', description: '',
  // Pricing fields
  default_hourly_rate: '', commission_percentage: '',
  // Service pricing (will be managed separately)
  service_pricing: {},
  // Shop assignments
  selected_shops: []
};

const TeamManagement = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [services, setServices] = useState([]);
  const [employmentStatuses, setEmploymentStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const { toast } = useToast();
  const { showDialog } = useAlertDialog();
  const { shops, currentShop, setCurrentShop, loading: shopLoading } = useShop();
  const [inputServiceValue, setInputServiceValue] = useState("");
  const [activeTab, setActiveTab] = useState('basic');
  const [servicePricing, setServicePricing] = useState({}); // { serviceId: { custom_price, commission_percentage } }
  const [hoveredTeamMember, setHoveredTeamMember] = useState(null);
  const [teamMemberTooltipPosition, setTeamMemberTooltipPosition] = useState({ x: 0, y: 0 });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    
    if (!currentShop) {
      setIsLoading(false);
      setTeamMembers([]);
      setServices([]);
      setEmploymentStatuses([]);
      return;
    }

    try {
      // First, get team members through team_member_shops junction table
      const { data: shopMembersData, error: membersError } = await supabase
        .from('team_member_shops')
        .select(`
          team_member_id,
          team_members (
            *,
            team_member_services(services(*)),
            employment_statuses(status_name),
            team_member_shops(shops(*))
          )
        `)
        .eq('shop_id', currentShop.id);

      if (membersError) {
        console.error('Error fetching team members from team_member_shops:', membersError);
        toast({ variant: 'destructive', title: 'Error Fetching Team Members', description: membersError.message });
        setIsLoading(false);
        return;
      }

      // Extract team members from the nested structure
      let teamMembersData = [];
      if (shopMembersData && shopMembersData.length > 0) {
        teamMembersData = shopMembersData
          .map(item => item.team_members)
          .filter(Boolean) // Remove any null/undefined entries
          .filter((member, index, self) => 
            // Remove duplicates
            index === self.findIndex(m => m.id === member.id)
          );
      }

      // If no members found through junction table, try direct query by shop_id (for backward compatibility)
      if (teamMembersData.length === 0) {
        console.log('No members in junction table, trying direct query by shop_id');
        const { data: directMembersData, error: directError } = await supabase
          .from('team_members')
          .select('*, team_member_services(services(*)), employment_statuses(status_name), team_member_shops(shops(*))')
          .eq('shop_id', currentShop.id);
        
        if (directError) {
          console.error('Error fetching team members by shop_id:', directError);
        } else {
          teamMembersData = directMembersData || [];
        }
      }

      // Fetch services and employment statuses
      const [servicesRes, statusesRes] = await Promise.all([
        supabase.from('services').select('*').eq('shop_id', currentShop.id),
        supabase.from('employment_statuses').select('*')
      ]);

      if (servicesRes.error || statusesRes.error) {
        toast({ variant: 'destructive', title: 'Error Fetching Data', description: servicesRes.error?.message || statusesRes.error?.message });
      }

      // Fetch appointments for all team members (upcoming and today's) for current shop
      const today = startOfDay(new Date());
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('*, services(name), clients(name), shops(name)')
        .eq('shop_id', currentShop.id)
        .gte('start_time', today.toISOString())
        .eq('type', 'appointment')
        .order('start_time', { ascending: true });

      // Group appointments by team_member_id
      const appointmentsByMember = {};
      if (appointmentsData) {
        appointmentsData.forEach(apt => {
          if (apt.team_member_id) {
            if (!appointmentsByMember[apt.team_member_id]) {
              appointmentsByMember[apt.team_member_id] = [];
            }
            appointmentsByMember[apt.team_member_id].push(apt);
          }
        });
      }

      // Transform team members to flatten services from team_member_services
      const transformedTeamMembers = (teamMembersData || []).map(member => ({
        ...member,
        services: (member.team_member_services || []).map(tms => tms.services).filter(Boolean),
        assigned_shops: (member.team_member_shops || []).map(tms => tms.shops).filter(Boolean),
        appointments: appointmentsByMember[member.id] || []
      }));
      
      setTeamMembers(transformedTeamMembers);
      setServices(servicesRes.data || []);
      setEmploymentStatuses(statusesRes.data || []);
    } catch (error) {
      console.error('Error in fetchData:', error);
      toast({ variant: 'destructive', title: 'Error Fetching Data', description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentShop]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = async (member = null) => {
    setEditingMember(member);
    if (member) {
      // Fetch service pricing for this member
      const { data: pricingData } = await supabase
        .from('team_member_service_pricing')
        .select('*')
        .eq('team_member_id', member.id);
      
      const pricingMap = {};
      if (pricingData) {
        pricingData.forEach(p => {
          pricingMap[p.service_id] = {
            custom_price: p.custom_price,
            commission_percentage: p.commission_percentage,
            is_active: p.is_active
          };
        });
      }
      setServicePricing(pricingMap);
      
      // Fetch shop assignments for this member
      const { data: shopAssignments } = await supabase
        .from('team_member_shops')
        .select('shop_id')
        .eq('team_member_id', member.id);
      
      const assignedShopIds = shopAssignments ? shopAssignments.map(sa => sa.shop_id) : [];
      
      setFormData({
        ...initialFormState,
        ...member,
        services: member.services ? member.services.map(s => s.id) : [],
        job_title: member.job_title || '',
        description: member.description || '',
        default_hourly_rate: member.default_hourly_rate || '',
        commission_percentage: member.commission_percentage || '',
        selected_shops: assignedShopIds,
      });
    } else {
      setFormData(initialFormState);
      setServicePricing({});
    }
    setActiveTab('basic');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMember(null);
    setFormData(initialFormState);
    setActiveTab('basic');
    setServicePricing({});
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : parseFloat(value)) : value)
    }));
  };
  const handleSelectChange = (name, value) => setFormData(prev => ({ ...prev, [name]: value }));
  const handleImageUpload = (url) => setFormData(prev => ({ ...prev, image_url: url }));
  
  
  const handleServicePricingChange = (serviceId, field, value) => {
    setServicePricing(prev => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value === '' ? null : (field === 'custom_price' || field === 'commission_percentage' ? parseFloat(value) : value)
      }
    }));
  };

  const handleWorkingDaysChange = (day) => {
    setFormData(prev => {
      const working_days = prev.working_days || [];
      const newDays = working_days.includes(day) ? working_days.filter(d => d !== day) : [...working_days, day];
      return { ...prev, working_days: newDays };
    });
  };

  const handleServiceToggle = (serviceId) => {
    setFormData(prev => {
      const currentServices = prev.services || [];
      const newServices = currentServices.includes(serviceId) ? currentServices.filter(id => id !== serviceId) : [...currentServices, serviceId];
      return { ...prev, services: newServices };
    });
  };

  const handleSelectAllServices = (checked) => {
    if (checked) {
        setFormData(prev => ({ ...prev, services: services.map(s => s.id) }));
    } else {
        setFormData(prev => ({ ...prev, services: [] }));
    }
  };

  const handleCreateService = async (serviceName) => {
    if (!serviceName) return;
    if (!currentShop) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
      return;
    }
    const { data, error } = await supabase.from('services').insert({ name: serviceName, duration: 30, shop_id: currentShop.id }).select().single();
    if (error) {
      toast({ variant: 'destructive', title: 'Could not create service', description: error.message });
    } else {
      toast({ title: `Service "${data.name}" created.` });
      setServices(prev => [...prev, data]);
      handleServiceToggle(data.id);
      setInputServiceValue("");
    }
  };

  const handleSaveMember = async () => {
    if (!currentShop) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
      return;
    }
    setIsSaving(true);
    const { services: serviceIds, employment_statuses, service_pricing, ...memberData } = formData;
    
    const upsertData = {
        id: editingMember?.id,
        name: memberData.name,
        email: memberData.email || null,
        phone: memberData.phone,
        image_url: memberData.image_url,
        working_days: memberData.working_days,
        employment_status_id: memberData.employment_status_id,
        shop_id: currentShop.id,
        // Public Profile
        job_title: memberData.job_title || null,
        description: memberData.description || null,
        // Pricing
        default_hourly_rate: memberData.default_hourly_rate ? parseFloat(memberData.default_hourly_rate) : null,
        commission_percentage: memberData.commission_percentage ? parseFloat(memberData.commission_percentage) : null,
    };

    const { data: savedMember, error: memberError } = await supabase.from('team_members').upsert(upsertData).select().single();
    
    if (memberError) {
      toast({ variant: 'destructive', title: 'Save Failed', description: memberError.message });
      setIsSaving(false);
      return;
    }
    
    const memberId = savedMember.id;
    
    // Update shop assignments based on user selection
    // First, delete all existing shop assignments for this member
    await supabase
      .from('team_member_shops')
      .delete()
      .eq('team_member_id', memberId);
    
    // Then, insert new shop assignments based on selected_shops
    if (formData.selected_shops && formData.selected_shops.length > 0) {
      const shopAssignments = formData.selected_shops.map(shopId => ({
        team_member_id: memberId,
        shop_id: shopId
      }));
      const { error: shopAssignError } = await supabase
        .from('team_member_shops')
        .insert(shopAssignments);
      if (shopAssignError) {
        console.error('Failed to assign member to shops:', shopAssignError);
        toast({ 
          variant: 'destructive', 
          title: 'Shop Assignment Failed', 
          description: shopAssignError.message 
        });
      }
    }
    
    // Update services
    const { error: deleteError } = await supabase.from('team_member_services').delete().eq('team_member_id', memberId);
    if (deleteError) toast({ variant: 'destructive', title: 'Failed to update services', description: deleteError.message });
    
    if (serviceIds && serviceIds.length > 0) {
      const serviceRelations = serviceIds.map(service_id => ({ team_member_id: memberId, service_id }));
      const { error: insertError } = await supabase.from('team_member_services').insert(serviceRelations);
      if (insertError) toast({ variant: 'destructive', title: 'Failed to link services', description: insertError.message });
    }
    
    // Update service pricing
    if (Object.keys(servicePricing).length > 0) {
      // Delete existing pricing
      await supabase.from('team_member_service_pricing').delete().eq('team_member_id', memberId);
      
      // Insert new pricing
      const pricingEntries = Object.entries(servicePricing)
        .filter(([_, pricing]) => pricing.custom_price || pricing.commission_percentage)
        .map(([serviceId, pricing]) => ({
          team_member_id: memberId,
          service_id: serviceId,
          custom_price: pricing.custom_price || null,
          commission_percentage: pricing.commission_percentage || null,
          is_active: pricing.is_active !== false
        }));
      
      if (pricingEntries.length > 0) {
        const { error: pricingError } = await supabase.from('team_member_service_pricing').insert(pricingEntries);
        if (pricingError) toast({ variant: 'destructive', title: 'Failed to save service pricing', description: pricingError.message });
      }
    }

    toast({ title: 'Success!', description: `Team member has been ${editingMember ? 'updated' : 'created'}.` });
    handleCloseDialog();
    fetchData();
    setIsSaving(false);
  };

  const handleDeleteMember = async (member) => {
    if (!currentShop) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
      return;
    }
    showDialog({
      title: `Delete "${member.name}"?`,
      description: 'This action cannot be undone. All associated data will be removed.',
      confirmText: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('team_members').delete().eq('id', member.id).eq('shop_id', currentShop.id);
        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Member Deleted', description: `"${member.name}" has been removed.` });
          fetchData();
        }
      },
    });
  };

  const selectedServicesObjects = services.filter(s => formData.services?.includes(s.id));

  const handleDownloadTemplate = () => {
    const statusExample = employmentStatuses.length > 0 ? employmentStatuses[0].status_name : 'Full-time';
    const templateData = [{
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        phone: '987-654-3210',
        employment_status: statusExample,
        working_days: 'Monday,Wednesday,Friday',
    }];
    const worksheet = utils.json_to_sheet(templateData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Team Members");
    writeFile(workbook, "team_members_template.xlsx");
    toast({ title: "Template downloaded", description: "Fill it out and upload to add team members." });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = utils.sheet_to_json(worksheet);

            const statusesMap = new Map(employmentStatuses.map(s => [s.status_name.toLowerCase(), s.id]));

            if (!currentShop) {
                toast({ variant: 'destructive', title: 'Upload Error', description: 'Please select a shop first.' });
                return;
            }

            const membersToInsert = jsonData.map(member => {
                const statusId = statusesMap.get(String(member.employment_status || '').toLowerCase());
                if (!member.name) return null;
                return {
                    name: member.name,
                    email: member.email || null,
                    phone: member.phone ? String(member.phone) : null,
                    employment_status_id: statusId || null,
                    working_days: member.working_days ? String(member.working_days).split(',').map(d => d.trim()) : [],
                    shop_id: currentShop.id,
                }
            }).filter(Boolean);

            if (membersToInsert.length === 0) {
                toast({ variant: 'destructive', title: 'Upload Error', description: 'No valid member data found. Check names and employment statuses.' });
                return;
            }
            
            const { error } = await supabase.from('team_members').insert(membersToInsert);
            if (error) throw error;
            
            toast({ title: 'Upload Successful!', description: `${membersToInsert.length} team members have been added.` });
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'Could not parse or upload the file.' });
        } finally {
            event.target.value = null; // Reset file input
        }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <Helmet><title>Team Management</title></Helmet>
      <Layout>
        <div className="p-4">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-4 justify-between items-center mb-6 pt-12">
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">Manage Team</h1>
              {/* Shop Selector */}
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
                <MapPin className="w-4 h-4 text-gray-600 ml-2" />
                {shopLoading ? (
                  <div className="w-[180px] h-8 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                  </div>
                ) : shops.length === 0 ? (
                  <div className="w-[180px] h-8 flex items-center justify-center text-sm text-gray-500">
                    No shops
                  </div>
                ) : (
                  <Select 
                    value={currentShop?.id || ''} 
                    onValueChange={(val) => {
                      const selectedShop = shops.find(s => s.id === val);
                      if (selectedShop) {
                        setCurrentShop(selectedShop);
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px] border-none bg-transparent focus:ring-0 text-gray-900 font-medium h-8">
                      <SelectValue placeholder="Select Shop">
                        {currentShop ? currentShop.name : (shops.length > 0 ? shops[0].name : 'Select Shop')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 text-gray-900 max-h-[300px] overflow-y-auto">
                      {shops.map(shop => (
                        <SelectItem key={shop.id} value={shop.id}>
                          {shop.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
             <div className="flex gap-2">
                <Button variant="outline" onClick={handleDownloadTemplate} className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50"><Download className="mr-2 h-4 w-4" /> Template</Button>
                <Button asChild variant="outline" className="bg-white border-gray-200 text-gray-700 hover:bg-gray-50">
                  <label>
                    <Upload className="mr-2 h-4 w-4" /> Upload
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                  </label>
                </Button>
                <Button onClick={() => handleOpenDialog()} className="bg-[#008000] hover:bg-[#006600] text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add Member
                </Button>
            </div>
          </motion.div>
          {!currentShop && !shopLoading ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-yellow-800">
                <MapPin className="w-5 h-5" />
                <p className="font-semibold">Please select a shop to view team members</p>
              </div>
            </div>
          ) : null}

          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 border border-gray-200 mb-6">
              <TabsTrigger value="members" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white text-gray-700">
                <User className="mr-2 h-4 w-4" />
                Team Members
              </TabsTrigger>
              <TabsTrigger value="roster" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white text-gray-700">
                <Calendar className="mr-2 h-4 w-4" />
                Roster
              </TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-6">
          {isLoading ? (
                <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#008000]" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.map(member => (
                <motion.div 
                  key={member.id} 
                  layout 
                  className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm flex flex-col cursor-pointer"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const tooltipWidth = 300;
                    const tooltipHeight = 400;
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;
                    
                    // Calculate position - try to show to the right first
                    let x = rect.right + 10;
                    let y = rect.top;
                    
                    // If tooltip would overflow right, show to the left
                    if (x + tooltipWidth > windowWidth) {
                      x = rect.left - tooltipWidth - 10;
                    }
                    
                    // If tooltip would overflow bottom, adjust y
                    if (y + tooltipHeight > windowHeight) {
                      y = windowHeight - tooltipHeight - 10;
                    }
                    
                    // Ensure tooltip doesn't go above viewport
                    if (y < 10) {
                      y = 10;
                    }
                    
                    // Ensure tooltip doesn't go left of viewport
                    if (x < 10) {
                      x = 10;
                    }
                    
                    setHoveredTeamMember(member);
                    setTeamMemberTooltipPosition({ x, y });
                  }}
                  onMouseLeave={() => {
                    setHoveredTeamMember(null);
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const tooltipWidth = 300;
                    const tooltipHeight = 400;
                    const windowWidth = window.innerWidth;
                    const windowHeight = window.innerHeight;
                    
                    // Calculate position - try to show to the right first
                    let x = rect.right + 10;
                    let y = rect.top;
                    
                    // If tooltip would overflow right, show to the left
                    if (x + tooltipWidth > windowWidth) {
                      x = rect.left - tooltipWidth - 10;
                    }
                    
                    // If tooltip would overflow bottom, adjust y
                    if (y + tooltipHeight > windowHeight) {
                      y = windowHeight - tooltipHeight - 10;
                    }
                    
                    // Ensure tooltip doesn't go above viewport
                    if (y < 10) {
                      y = 10;
                    }
                    
                    // Ensure tooltip doesn't go left of viewport
                    if (x < 10) {
                      x = 10;
                    }
                    
                    setTeamMemberTooltipPosition({ x, y });
                  }}
                >
                  <div className="flex items-center gap-4">
                    <img 
                      src={member.image_url || `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}&background=random`} 
                      alt={member.name} 
                      className="w-16 h-16 rounded-full border-2 border-[#008000] object-cover" 
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
                      <h2 className="text-xl font-bold text-gray-900">{member.name}</h2>
                      <p className="text-[#008000]">{member.employment_statuses?.status_name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex-grow">
                    <p className="text-gray-600 text-sm mb-2">Services:</p>
                    <div className="flex flex-wrap gap-2">
                      {(member.services || []).map(s => <Badge key={s.id} variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">{s.name}</Badge>)}
                      {(member.services || []).length === 0 && <p className="text-xs text-gray-400">No services assigned.</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(member)} className="flex-1 bg-white border-gray-200 text-gray-700 hover:bg-gray-50"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteMember(member)} className="flex-1"><Trash className="mr-2 h-4 w-4" /> Delete</Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
            </TabsContent>

            <TabsContent value="roster" className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#008000]" /></div>
              ) : shops.length === 0 ? (
                <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
                  <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Shops Available</h3>
                  <p className="text-gray-600">Please add shops first to view the roster.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {shops.map(shop => {
                    // Get team members assigned to this shop
                    const shopMembers = teamMembers.filter(member => 
                      member.assigned_shops && member.assigned_shops.some(s => s.id === shop.id)
                    );

                    return (
                      <motion.div
                        key={shop.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                      >
                        <div className="bg-gradient-to-r from-[#008000] to-[#006600] p-4 text-white">
                          <div className="flex items-center gap-3">
                            <Building2 className="w-6 h-6" />
                            <div>
                              <h2 className="text-xl font-bold">{shop.name}</h2>
                              <p className="text-sm text-green-100">
                                {shopMembers.length} {shopMembers.length === 1 ? 'team member' : 'team members'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-6">
                          {shopMembers.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>No team members assigned to this shop</p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {shopMembers.map(member => {
                                const memberAppointments = member.appointments || [];
                                const todayAppointments = memberAppointments.filter(apt => {
                                  const aptDate = parseISO(apt.start_time);
                                  return isToday(aptDate);
                                });
                                const upcomingAppointments = memberAppointments.filter(apt => {
                                  const aptDate = parseISO(apt.start_time);
                                  return isFuture(aptDate) && !isToday(aptDate);
                                });

                                return (
                                  <motion.div
                                    key={member.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white rounded-lg border border-gray-200 hover:border-[#008000] transition-colors overflow-hidden"
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const tooltipWidth = 300;
                                      const tooltipHeight = 400;
                                      const windowWidth = window.innerWidth;
                                      const windowHeight = window.innerHeight;
                                      
                                      // Calculate position - try to show to the right first
                                      let x = rect.right + 10;
                                      let y = rect.top;
                                      
                                      // If tooltip would overflow right, show to the left
                                      if (x + tooltipWidth > windowWidth) {
                                        x = rect.left - tooltipWidth - 10;
                                      }
                                      
                                      // If tooltip would overflow bottom, adjust y
                                      if (y + tooltipHeight > windowHeight) {
                                        y = windowHeight - tooltipHeight - 10;
                                      }
                                      
                                      // Ensure tooltip doesn't go above viewport
                                      if (y < 10) {
                                        y = 10;
                                      }
                                      
                                      // Ensure tooltip doesn't go left of viewport
                                      if (x < 10) {
                                        x = 10;
                                      }
                                      
                                      setHoveredTeamMember(member);
                                      setTeamMemberTooltipPosition({ x, y });
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredTeamMember(null);
                                    }}
                                    onMouseMove={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const tooltipWidth = 300;
                                      const tooltipHeight = 400;
                                      const windowWidth = window.innerWidth;
                                      const windowHeight = window.innerHeight;
                                      
                                      // Calculate position - try to show to the right first
                                      let x = rect.right + 10;
                                      let y = rect.top;
                                      
                                      // If tooltip would overflow right, show to the left
                                      if (x + tooltipWidth > windowWidth) {
                                        x = rect.left - tooltipWidth - 10;
                                      }
                                      
                                      // If tooltip would overflow bottom, adjust y
                                      if (y + tooltipHeight > windowHeight) {
                                        y = windowHeight - tooltipHeight - 10;
                                      }
                                      
                                      // Ensure tooltip doesn't go above viewport
                                      if (y < 10) {
                                        y = 10;
                                      }
                                      
                                      // Ensure tooltip doesn't go left of viewport
                                      if (x < 10) {
                                        x = 10;
                                      }
                                      
                                      setTeamMemberTooltipPosition({ x, y });
                                    }}
                                  >
                                    <div 
                                      className="p-4 cursor-pointer"
                                      onClick={() => handleOpenDialog(member)}
                                    >
                                      <div className="flex items-center gap-3 mb-3">
                                        <img
                                          src={member.image_url || `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}&background=008000&color=ffffff&size=128`}
                                          alt={member.name}
                                          className="w-12 h-12 rounded-full border-2 border-[#008000] object-cover"
                                          onError={(e) => {
                                            const fallbackUrl = `https://ui-avatars.com/api/?name=${member.name.replace(' ', '+')}&background=008000&color=ffffff&size=128`;
                                            if (e.target.src !== fallbackUrl) {
                                              e.target.src = fallbackUrl;
                                            } else {
                                              e.target.style.display = 'none';
                                            }
                                          }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <h3 className="font-semibold text-gray-900 truncate">{member.name}</h3>
                                          <p className="text-sm text-[#008000] truncate">
                                            {member.employment_statuses?.status_name || 'No status'}
                                          </p>
                                          {member.job_title && (
                                            <p className="text-xs text-gray-500 truncate mt-1">{member.job_title}</p>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-semibold text-gray-900">
                                            {memberAppointments.length}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {memberAppointments.length === 1 ? 'appointment' : 'appointments'}
                                          </div>
                                        </div>
                                      </div>
                                      {member.services && member.services.length > 0 && (
                                        <div className="mb-3 flex flex-wrap gap-1">
                                          {member.services.slice(0, 3).map(service => (
                                            <Badge key={service.id} variant="secondary" className="bg-[#008000]/10 text-[#008000] border-[#008000]/20 text-xs">
                                              {service.name}
                                            </Badge>
                                          ))}
                                          {member.services.length > 3 && (
                                            <Badge variant="secondary" className="bg-gray-200 text-gray-600 border-gray-300 text-xs">
                                              +{member.services.length - 3} more
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Appointments Section */}
                                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                                      {memberAppointments.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-2">No upcoming appointments</p>
                                      ) : (
                                        <div className="space-y-2">
                                          {todayAppointments.length > 0 && (
                                            <div>
                                              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Today ({todayAppointments.length})
                                              </p>
                                              <div className="space-y-1.5">
                                                {todayAppointments.slice(0, 3).map(apt => {
                                                  const aptDate = parseISO(apt.start_time);
                                                  return (
                                                    <div key={apt.id} className="bg-white rounded p-2 border border-gray-200 text-xs">
                                                      <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                          <Clock className="w-3 h-3 text-[#008000]" />
                                                          <span className="font-medium text-gray-900">
                                                            {format(aptDate, 'HH:mm')}
                                                          </span>
                                                        </div>
                                                        <Badge className="bg-[#008000]/10 text-[#008000] border-[#008000]/20 text-xs px-1.5 py-0">
                                                          {apt.services?.name || 'Service'}
                                                        </Badge>
                                                      </div>
                                                      <div className="mt-1 text-gray-600 truncate">
                                                        <UserIcon className="w-3 h-3 inline mr-1" />
                                                        {apt.clients?.name || apt.client_name || 'Client'}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                                {todayAppointments.length > 3 && (
                                                  <p className="text-xs text-gray-500 text-center">
                                                    +{todayAppointments.length - 3} more today
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                          {upcomingAppointments.length > 0 && (
                                            <div className={todayAppointments.length > 0 ? 'mt-3' : ''}>
                                              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Upcoming ({upcomingAppointments.length})
                                              </p>
                                              <div className="space-y-1.5">
                                                {upcomingAppointments.slice(0, 2).map(apt => {
                                                  const aptDate = parseISO(apt.start_time);
                                                  return (
                                                    <div key={apt.id} className="bg-white rounded p-2 border border-gray-200 text-xs">
                                                      <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                          <Calendar className="w-3 h-3 text-gray-500" />
                                                          <span className="font-medium text-gray-900">
                                                            {format(aptDate, 'MMM d, HH:mm')}
                                                          </span>
                                                        </div>
                                                        <Badge className="bg-[#008000]/10 text-[#008000] border-[#008000]/20 text-xs px-1.5 py-0">
                                                          {apt.services?.name || 'Service'}
                                                        </Badge>
                                                      </div>
                                                      <div className="mt-1 text-gray-600 truncate">
                                                        <UserIcon className="w-3 h-3 inline mr-1" />
                                                        {apt.clients?.name || apt.client_name || 'Client'}
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                                {upcomingAppointments.length > 2 && (
                                                  <p className="text-xs text-gray-500 text-center">
                                                    +{upcomingAppointments.length - 2} more upcoming
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingMember ? 'Edit' : 'Add'} Team Member</DialogTitle>
              <DialogDescription>
                {editingMember 
                  ? 'Update the team member information below.' 
                  : 'Add a new team member by filling in the details below.'}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-gray-100 border border-gray-200">
                <TabsTrigger value="basic" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white">
                  <User className="w-4 h-4 mr-2" />
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="pricing" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Pricing & Services
                </TabsTrigger>
                <TabsTrigger value="profile" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white">
                  <Globe className="w-4 h-4 mr-2" />
                  Public Profile
                </TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <ImageUploader onUploadSuccess={handleImageUpload} initialImageUrl={formData.image_url} />
                </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input name="name" value={formData.name || ''} onChange={handleFormChange} className="bg-white border-gray-300 text-gray-900" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Employment Status</Label>
                  <Select onValueChange={(value) => handleSelectChange('employment_status_id', value)} value={formData.employment_status_id}>
                      <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200 text-gray-900">
                      {employmentStatuses.map(status => <SelectItem key={status.id} value={status.id}>{status.status_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" value={formData.email || ''} onChange={handleFormChange} className="bg-white border-gray-300 text-gray-900" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input name="phone" type="tel" value={formData.phone || ''} onChange={handleFormChange} className="bg-white border-gray-300 text-gray-900" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Working Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeek.map(day => (
                      <button 
                        key={day} 
                        onClick={() => handleWorkingDaysChange(day)} 
                        className={`text-sm px-3 py-1.5 rounded-full transition-colors ${
                          formData.working_days?.includes(day) 
                            ? 'bg-[#008000] text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign to Shops</Label>
                  <div className="space-y-2">
                    {shops && shops.length > 0 ? (
                      shops.map(shop => (
                        <div key={shop.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`shop-${shop.id}`}
                            checked={formData.selected_shops?.includes(shop.id) || false}
                            onCheckedChange={(checked) => {
                              setFormData(prev => {
                                const currentShops = prev.selected_shops || [];
                                if (checked) {
                                  return { ...prev, selected_shops: [...currentShops, shop.id] };
                                } else {
                                  return { ...prev, selected_shops: currentShops.filter(id => id !== shop.id) };
                                }
                              });
                            }}
                          />
                          <Label 
                            htmlFor={`shop-${shop.id}`}
                            className="text-sm font-normal cursor-pointer text-gray-700"
                          >
                            {shop.name}
                          </Label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No shops available. Please add shops first.</p>
                    )}
                  </div>
                  {formData.selected_shops && formData.selected_shops.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Selected {formData.selected_shops.length} shop{formData.selected_shops.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Pricing & Services Tab */}
              <TabsContent value="pricing" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Hourly Rate (£)</Label>
                    <Input 
                      name="default_hourly_rate" 
                      type="number" 
                      step="0.01"
                      value={formData.default_hourly_rate || ''} 
                      onChange={handleFormChange} 
                      className="bg-white border-gray-300 text-gray-900" 
                      placeholder="0.00"
                    />
              </div>
                  <div className="space-y-2">
                    <Label>Default Commission (%)</Label>
                    <Input 
                      name="commission_percentage" 
                      type="number" 
                      step="0.01"
                      value={formData.commission_percentage || ''} 
                      onChange={handleFormChange} 
                      className="bg-white border-gray-300 text-gray-900" 
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
              <div className="space-y-2">
                <Label>Services</Label>
                  <Command className="rounded-lg border border-gray-200 bg-white">
                  <CommandInput placeholder="Search or create service..." value={inputServiceValue} onValueChange={setInputServiceValue} className="placeholder:text-gray-400" />
                    <div className="flex flex-wrap gap-2 p-2 border-b border-gray-200 min-h-[40px]">
                    {selectedServicesObjects.map(service => (
                        <Badge key={service.id} variant="secondary" className="bg-[#008000]/10 text-[#008000] border-[#008000]/20">
                        {service.name}
                          <button onClick={() => handleServiceToggle(service.id)} className="ml-2 rounded-full outline-none"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                    <CommandList className="max-h-[300px] overflow-y-auto">
                      <CommandEmpty>
                        <div onClick={() => handleCreateService(inputServiceValue)} className="cursor-pointer p-2 text-center text-sm text-gray-600 hover:bg-gray-50">
                          Create new service: "{inputServiceValue}"
                        </div>
                      </CommandEmpty>
                      {(() => {
                        // Group services by category
                        const servicesByCategory = services.reduce((acc, service) => {
                          const category = service.category || 'Uncategorized';
                          if (!acc[category]) {
                            acc[category] = [];
                          }
                          acc[category].push(service);
                          return acc;
                        }, {});
                        
                        const categories = Object.keys(servicesByCategory).sort();
                        
                        return categories.map(category => (
                          <CommandGroup key={category} heading={category}>
                            <div className="flex items-center space-x-2 p-2 bg-gray-50 border-b border-gray-200">
                            <Checkbox
                                id={`select-all-${category}`}
                                checked={servicesByCategory[category].every(s => formData.services?.includes(s.id)) && servicesByCategory[category].length > 0}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    const categoryServiceIds = servicesByCategory[category].map(s => s.id);
                                    setFormData(prev => ({
                                      ...prev,
                                      services: [...new Set([...(prev.services || []), ...categoryServiceIds])]
                                    }));
                                  } else {
                                    const categoryServiceIds = servicesByCategory[category].map(s => s.id);
                                    setFormData(prev => ({
                                      ...prev,
                                      services: (prev.services || []).filter(id => !categoryServiceIds.includes(id))
                                    }));
                                  }
                                }}
                                className="border-gray-300"
                            />
                              <label htmlFor={`select-all-${category}`} className="text-sm font-semibold text-gray-900">
                                Select All in {category}
                            </label>
                        </div>
                            {servicesByCategory[category].map((service) => (
                              <CommandItem 
                                key={service.id} 
                                onSelect={() => handleServiceToggle(service.id)} 
                                className="cursor-pointer pl-8"
                              >
                                <Checkbox
                                    checked={formData.services?.includes(service.id)}
                                  className="mr-2 border-gray-300"
                                    readOnly
                                />
                                <div className="flex-1">
                                  <span className="text-gray-900">{service.name}</span>
                                  {service.subcategory && (
                                    <span className="text-xs text-gray-500 ml-2">({service.subcategory})</span>
                                  )}
                                </div>
                                {service.price > 0 && (
                                  <span className="text-xs text-gray-500 ml-2">£{parseFloat(service.price).toFixed(2)}</span>
                                )}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                        ));
                      })()}
                  </CommandList>
                </Command>
              </div>

                {/* Service-Specific Pricing */}
                {formData.services && formData.services.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-lg font-semibold">Service-Specific Pricing</Label>
                    <div className="space-y-4 max-h-60 overflow-y-auto">
                      {(() => {
                        // Group selected services by category
                        const selectedServices = formData.services
                          .map(id => services.find(s => s.id === id))
                          .filter(Boolean);
                        
                        const servicesByCategory = selectedServices.reduce((acc, service) => {
                          const category = service.category || 'Uncategorized';
                          if (!acc[category]) {
                            acc[category] = [];
                          }
                          acc[category].push(service);
                          return acc;
                        }, {});
                        
                        const categories = Object.keys(servicesByCategory).sort();
                        
                        return categories.map(category => (
                          <div key={category} className="space-y-2">
                            <div className="font-semibold text-gray-900 text-sm bg-gray-100 px-3 py-2 rounded-t-lg border-b border-gray-200">
                              {category}
                            </div>
                            <div className="space-y-2 pl-2">
                              {servicesByCategory[category].map(service => {
                                const pricing = servicePricing[service.id] || {};
                                return (
                                  <div key={service.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                                    <div className="font-medium text-gray-900 mb-2 text-sm">
                                      {service.name}
                                      {service.subcategory && (
                                        <span className="text-xs text-gray-500 ml-1">({service.subcategory})</span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Custom Price (£)</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={pricing.custom_price || ''}
                                          onChange={(e) => handleServicePricingChange(service.id, 'custom_price', e.target.value)}
                                          className="bg-white border-gray-300 text-gray-900 text-sm"
                                          placeholder={service.price ? `Default: £${parseFloat(service.price).toFixed(2)}` : '0.00'}
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Commission (%)</Label>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={pricing.commission_percentage || ''}
                                          onChange={(e) => handleServicePricingChange(service.id, 'commission_percentage', e.target.value)}
                                          className="bg-white border-gray-300 text-gray-900 text-sm"
                                          placeholder={formData.commission_percentage ? `Default: ${formData.commission_percentage}%` : '0.00'}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Public Profile Tab */}
              <TabsContent value="profile" className="space-y-4 mt-4">
              <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input 
                    name="job_title" 
                    value={formData.job_title || ''} 
                    onChange={handleFormChange} 
                    className="bg-white border-gray-300 text-gray-900" 
                    placeholder="e.g., Senior Stylist, Master Barber, Nail Specialist"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    name="description"
                    value={formData.description || ''}
                    onChange={handleFormChange}
                    className="bg-white border-gray-300 text-gray-900 min-h-[150px]"
                    placeholder="Write a description about this team member..."
                  />
              </div>
              </TabsContent>

            </Tabs>

            <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button onClick={handleCloseDialog} variant="outline" className="flex-1 bg-white border-gray-200 hover:bg-gray-50 text-gray-700">
                Cancel
              </Button>
              <Button onClick={handleSaveMember} disabled={isSaving || !formData.name} className="flex-1 bg-[#008000] hover:bg-[#006600] text-white">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Member'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Team Member Details Tooltip */}
        {hoveredTeamMember && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[100] bg-white border-2 border-gray-200 rounded-lg shadow-2xl p-4 min-w-[280px] max-w-[320px] pointer-events-none"
            style={{
              left: `${teamMemberTooltipPosition.x}px`,
              top: `${teamMemberTooltipPosition.y}px`,
              maxHeight: `${Math.min(400, window.innerHeight - teamMemberTooltipPosition.y - 20)}px`,
              overflowY: 'auto',
              maxWidth: `${Math.min(320, window.innerWidth - teamMemberTooltipPosition.x - 20)}px`
            }}
          >
            <div className="space-y-3">
              {/* Team Member Name & Image */}
              <div className="flex items-center gap-3 pb-2 border-b border-gray-200">
                <img 
                  src={hoveredTeamMember.image_url || `https://ui-avatars.com/api/?name=${hoveredTeamMember.name}&background=008000&color=ffffff&size=128`} 
                  alt={hoveredTeamMember.name}
                  className="w-16 h-16 rounded-full border-2 border-gray-200 object-cover"
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${hoveredTeamMember.name.replace(' ', '+')}&background=008000&color=ffffff&size=128`;
                  }}
                />
                <div>
                  <div className="font-bold text-lg text-gray-900">
                    {hoveredTeamMember.name}
                  </div>
                  {hoveredTeamMember.job_title && (
                    <div className="text-sm text-gray-600 mt-1">
                      {hoveredTeamMember.job_title}
                    </div>
                  )}
                  {hoveredTeamMember.employment_statuses?.status_name && (
                    <div className="text-xs text-[#008000] mt-1">
                      {hoveredTeamMember.employment_statuses.status_name}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              {(hoveredTeamMember.email || hoveredTeamMember.phone) && (
                <>
                  <div className="border-t border-gray-200"></div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      <span>Contact</span>
                    </div>
                    {hoveredTeamMember.email && (
                      <div className="text-sm text-gray-900 mb-1">
                        {hoveredTeamMember.email}
                      </div>
                    )}
                    {hoveredTeamMember.phone && (
                      <div className="text-sm text-gray-900">
                        {hoveredTeamMember.phone}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Working Days */}
              {hoveredTeamMember.working_days && hoveredTeamMember.working_days.length > 0 && (
                <>
                  <div className="border-t border-gray-200"></div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      <span>Working Days</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(() => {
                        let workingDays = hoveredTeamMember.working_days;
                        if (typeof workingDays === 'string') {
                          workingDays = workingDays.split(',').map(day => day.trim()).filter(day => day.length > 0);
                        }
                        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                        return daysOfWeek.map(day => {
                          const isWorking = Array.isArray(workingDays) && workingDays.includes(day);
                          return (
                            <span
                              key={day}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                isWorking 
                                  ? 'bg-[#008000] text-white' 
                                  : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {day.substring(0, 3)}
                            </span>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </>
              )}

              {/* Description */}
              {hoveredTeamMember.description && (
                <>
                  <div className="border-t border-gray-200"></div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Description</div>
                    <div className="text-sm text-gray-700">
                      {hoveredTeamMember.description}
                    </div>
                  </div>
                </>
              )}

              {/* Pricing Information */}
              {(hoveredTeamMember.default_hourly_rate || hoveredTeamMember.commission_percentage) && (
                <>
                  <div className="border-t border-gray-200"></div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      <span>Pricing</span>
                    </div>
                    {hoveredTeamMember.default_hourly_rate && (
                      <div className="text-sm text-gray-900 mb-1">
                        Hourly Rate: ${parseFloat(hoveredTeamMember.default_hourly_rate).toFixed(2)}
                      </div>
                    )}
                    {hoveredTeamMember.commission_percentage && (
                      <div className="text-sm text-gray-900">
                        Commission: {parseFloat(hoveredTeamMember.commission_percentage).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Services */}
              {hoveredTeamMember.services && hoveredTeamMember.services.length > 0 && (
                <>
                  <div className="border-t border-gray-200"></div>
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Services</div>
                    <div className="flex flex-wrap gap-1">
                      {hoveredTeamMember.services.slice(0, 5).map(service => (
                        <Badge key={service.id} variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                          {service.name}
                        </Badge>
                      ))}
                      {hoveredTeamMember.services.length > 5 && (
                        <Badge variant="secondary" className="bg-gray-200 text-gray-600 border-gray-300 text-xs">
                          +{hoveredTeamMember.services.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </Layout>
    </>
  );
};

export default TeamManagement;