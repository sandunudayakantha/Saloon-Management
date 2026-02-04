import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Save, Clock, Loader2, Download, Upload, DollarSign, FileText, AlertCircle, Share2, Settings, Tag, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Layout from '@/components/Layout';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import { useShop } from '@/contexts/ShopContext';
import { utils, writeFile, read } from 'xlsx';

const ServiceManagement = () => {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    duration: '',
    buffer_time: '',
    price: '',
    description: '',
    fine_print: '',
    distribution: ''
  });
  const [isPriceAutoCalculated, setIsPriceAutoCalculated] = useState(false);
  const [systemHourlyRate, setSystemHourlyRate] = useState(null);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsHourlyRate, setSettingsHourlyRate] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryObjects, setCategoryObjects] = useState([]);
  const [isCategoriesDialogOpen, setIsCategoriesDialogOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', description: '' });
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [activeTab, setActiveTab] = useState('service');
  const { toast } = useToast();
  const { showDialog } = useAlertDialog();
  const { currentShop, shops, setCurrentShop, loading: shopLoading } = useShop();

  const fetchServices = useCallback(async () => {
    if (!currentShop) {
      setIsLoading(false);
      setServices([]);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', currentShop.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error Fetching Services',
        description: error.message,
      });
      setServices([]);
    } else {
      setServices(data || []);
    }
    setIsLoading(false);
  }, [toast, currentShop]);

  const fetchSystemHourlyRate = useCallback(async () => {
    if (!currentShop) {
      setSystemHourlyRate(0);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'hourly_rate')
        .eq('shop_id', currentShop.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching hourly rate:', error);
      } else if (data) {
        setSystemHourlyRate(parseFloat(data.setting_value) || 0);
      } else {
        setSystemHourlyRate(0);
      }
    } catch (error) {
      console.error('Error fetching system hourly rate:', error);
      setSystemHourlyRate(0);
    }
  }, [currentShop]);

  const fetchCategories = useCallback(async () => {
    if (!currentShop) {
      setCategories([]);
      setCategoryObjects([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('shop_id', currentShop.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        // Fallback to hardcoded categories if table doesn't exist
        const fallbackCategories = ['Hair', 'Nails', 'Facial', 'Massage', 'Waxing', 'Makeup', 'Brows & Lashes', 'Body Treatment', 'Other'];
        setCategories(fallbackCategories);
        setCategoryObjects([]);
      } else if (data && data.length > 0) {
        setCategories(data.map(cat => cat.name));
        setCategoryObjects(data);
      } else {
        // Fallback to hardcoded categories if no categories found
        const fallbackCategories = ['Hair', 'Nails', 'Facial', 'Massage', 'Waxing', 'Makeup', 'Brows & Lashes', 'Body Treatment', 'Other'];
        setCategories(fallbackCategories);
        setCategoryObjects([]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Fallback to hardcoded categories
      const fallbackCategories = ['Hair', 'Nails', 'Facial', 'Massage', 'Waxing', 'Makeup', 'Brows & Lashes', 'Body Treatment', 'Other'];
      setCategories(fallbackCategories);
      setCategoryObjects([]);
    }
  }, [currentShop]);

  useEffect(() => {
    fetchServices();
    fetchSystemHourlyRate();
    fetchCategories();
  }, [fetchServices, fetchSystemHourlyRate, fetchCategories]);

  // Auto-calculate price when system hourly rate and duration change
  useEffect(() => {
    const hourlyRate = systemHourlyRate;
    const duration = parseInt(formData.duration, 10);

    // Only auto-calculate if both system hourly_rate and duration are valid
    if (hourlyRate && hourlyRate > 0 && !isNaN(duration) && duration > 0) {
      // Calculate price: (hourly_rate / 60) * duration
      const calculatedPrice = (hourlyRate / 60) * duration;

      // For new services, always auto-calculate
      // For editing, only auto-calculate if price is empty or was previously auto-calculated
      if (!editingService || !formData.price || isPriceAutoCalculated) {
        setFormData(prev => ({ ...prev, price: calculatedPrice.toFixed(2) }));
        setIsPriceAutoCalculated(true);
      }
    } else if (!systemHourlyRate || systemHourlyRate === 0) {
      // Reset auto-calculated flag if system hourly rate is not set
      setIsPriceAutoCalculated(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemHourlyRate, formData.duration]);

  const handleOpenDialog = (service = null) => {
    setEditingService(service);
    setFormData(service ? {
      name: service.name || '',
      category: service.category || '',
      subcategory: service.subcategory || '',
      duration: service.duration || '',
      buffer_time: service.buffer_time || '',
      price: service.price || '',
      description: service.description || '',
      fine_print: service.fine_print || '',
      distribution: service.distribution || ''
    } : {
      name: '',
      category: '',
      subcategory: '',
      duration: '',
      buffer_time: '',
      price: '',
      description: '',
      fine_print: '',
      distribution: ''
    });
    setIsPriceAutoCalculated(false);
    setActiveTab('service');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    setFormData({
      name: '',
      category: '',
      subcategory: '',
      duration: '',
      buffer_time: '',
      price: '',
      description: '',
      fine_print: '',
      distribution: ''
    });
    setIsPriceAutoCalculated(false);
    setActiveTab('service');
  };

  const handleOpenSettingsDialog = async () => {
    setSettingsHourlyRate(systemHourlyRate?.toString() || '0.00');
    setIsSettingsDialogOpen(true);
  };

  const handleSaveSystemHourlyRate = async () => {
    if (!currentShop) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a shop first.'
      });
      return;
    }

    const hourlyRate = parseFloat(settingsHourlyRate);
    if (isNaN(hourlyRate) || hourlyRate < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Hourly Rate',
        description: 'Please enter a valid hourly rate (0 or greater).'
      });
      return;
    }

    setIsSavingSettings(true);
    try {
      // Try to update existing setting for this shop
      const { data: existingData, error: selectError } = await supabase
        .from('system_settings')
        .select('id')
        .eq('setting_key', 'hourly_rate')
        .eq('shop_id', currentShop.id)
        .maybeSingle();

      if (existingData) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({ setting_value: hourlyRate.toFixed(2) })
          .eq('setting_key', 'hourly_rate')
          .eq('shop_id', currentShop.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('system_settings')
          .insert([{
            setting_key: 'hourly_rate',
            setting_value: hourlyRate.toFixed(2),
            shop_id: currentShop.id,
            description: 'Shop-specific hourly rate for automatic price calculation'
          }]);

        if (error) throw error;
      }

      setSystemHourlyRate(hourlyRate);
      toast({
        title: 'Success!',
        description: `System hourly rate has been set to £${hourlyRate.toFixed(2)}/hour.`
      });
      setIsSettingsDialogOpen(false);
    } catch (error) {
      console.error('Error saving hourly rate:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Failed to save hourly rate. Please try again.'
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleOpenCategoriesDialog = () => {
    setCategoryFormData({ name: '', description: '' });
    setEditingCategory(null);
    setIsCategoriesDialogOpen(true);
  };

  const handleOpenEditCategory = (category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name || '',
      description: category.description || ''
    });
    setIsCategoriesDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Category name is required.'
      });
      return;
    }
    if (!currentShop) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please select a shop first.'
      });
      return;
    }

    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        // Update existing category
        const { error } = await supabase
          .from('service_categories')
          .update({
            name: categoryFormData.name.trim(),
            description: categoryFormData.description?.trim() || null
          })
          .eq('id', editingCategory.id)
          .eq('shop_id', currentShop.id);

        if (error) throw error;

        toast({
          title: 'Success!',
          description: `Category "${categoryFormData.name}" has been updated.`
        });
      } else {
        // Insert new category
        const { error } = await supabase
          .from('service_categories')
          .insert([{
            name: categoryFormData.name.trim(),
            description: categoryFormData.description?.trim() || null,
            shop_id: currentShop.id,
            display_order: 999 // Add to end
          }]);

        if (error) throw error;

        toast({
          title: 'Success!',
          description: `Category "${categoryFormData.name}" has been added.`
        });
      }

      setIsCategoriesDialogOpen(false);
      setCategoryFormData({ name: '', description: '' });
      setEditingCategory(null);
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: error.message || 'Failed to save category. Please try again.'
      });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = (category) => {
    showDialog({
      title: `Delete "${category.name}"?`,
      description: 'This will mark the category as inactive. Services using this category will not be affected, but the category will no longer appear in the dropdown.',
      confirmText: 'Delete',
      onConfirm: async () => {
        if (!currentShop) {
          toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
          return;
        }
        const { error } = await supabase
          .from('service_categories')
          .update({ is_active: false })
          .eq('id', category.id)
          .eq('shop_id', currentShop.id);

        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Category Deleted', description: `"${category.name}" has been removed.` });
          fetchCategories();
        }
      },
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // If user manually changes price, mark it as not auto-calculated
    if (name === 'price') {
      setIsPriceAutoCalculated(false);
    }
  };

  const handleSaveService = async () => {
    if (!formData.name || !formData.duration) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Service name and duration are required.' });
      return;
    }

    const duration = parseInt(formData.duration, 10);
    if (isNaN(duration) || duration <= 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Duration must be a positive number.' });
      return;
    }

    const bufferTime = formData.buffer_time ? parseInt(formData.buffer_time, 10) : 0;
    if (bufferTime < 0) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Buffer time cannot be negative.' });
      return;
    }

    setIsSaving(true);

    if (!currentShop) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
      setIsSaving(false);
      return;
    }

    const serviceData = {
      name: formData.name.trim(),
      category: formData.category?.trim() || null,
      subcategory: formData.subcategory?.trim() || null,
      duration: duration,
      buffer_time: bufferTime || 0,
      price: formData.price ? parseFloat(formData.price) : 0.00,
      description: formData.description?.trim() || null,
      fine_print: formData.fine_print?.trim() || null,
      distribution: formData.distribution?.trim() || null,
      shop_id: currentShop.id,
    };

    try {
      let response;
      if (editingService) {
        response = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id)
          .eq('shop_id', currentShop.id)
          .select();
      } else {
        response = await supabase
          .from('services')
          .insert([serviceData])
          .select();
      }

      const { data, error } = response;

      if (error) {
        console.error('Save error:', error);
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: error.message || 'Failed to save service. Please try again.'
        });
      } else if (data && data.length > 0) {
        toast({
          title: 'Success!',
          description: `Service "${data[0].name}" has been ${editingService ? 'updated' : 'created'} successfully.`
        });
        handleCloseDialog();
        fetchServices();
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: 'Service was not saved. Please try again.'
        });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteService = (serviceId, serviceName) => {
    if (!currentShop) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
      return;
    }
    showDialog({
      title: `Delete "${serviceName}"?`,
      description: 'This action cannot be undone. Are you sure you want to permanently delete this service?',
      confirmText: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('services').delete().eq('id', serviceId).eq('shop_id', currentShop.id);
        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Service Deleted', description: `"${serviceName}" has been removed.` });
          fetchServices();
        }
      },
    });
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        name: 'Full Hair Cut',
        category: 'Hair',
        subcategory: 'Full Hair Cut',
        duration: 60,
        buffer_time: 10,
        price: 75.00,
        description: 'Professional haircut service with styling consultation and finishing.',
        fine_print: 'Cancellation must be made 24 hours in advance. No refunds for no-shows.',
        distribution: 'Available at all locations. Walk-ins welcome based on availability.'
      },
      {
        name: 'Classic Manicure',
        category: 'Nails',
        subcategory: 'Classic Manicure',
        duration: 45,
        buffer_time: 5,
        price: 35.00,
        description: 'Complete nail care including shaping, cuticle care, and polish application.',
        fine_print: 'No refunds after service completion. Please arrive with clean hands.',
        distribution: 'Available at all locations. Walk-ins accepted.'
      }
    ];
    const worksheet = utils.json_to_sheet(templateData);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 25 }, // name
      { wch: 15 }, // category
      { wch: 25 }, // subcategory
      { wch: 12 }, // duration
      { wch: 12 }, // buffer_time
      { wch: 12 }, // price
      { wch: 60 }, // description
      { wch: 60 }, // fine_print
      { wch: 60 }  // distribution
    ];

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Services");
    writeFile(workbook, "services_template.xlsx");
    toast({
      title: "Template downloaded",
      description: "Template includes category and subcategory columns. Category: select from dropdown options. Subcategory: type your own."
    });
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

        if (!currentShop) {
          toast({ variant: 'destructive', title: 'Upload Error', description: 'Please select a shop first.' });
          return;
        }

        const servicesToInsert = jsonData.map(service => ({
          name: service.name,
          category: service.category?.trim() || null,
          subcategory: service.subcategory?.trim() || null,
          duration: parseInt(service.duration, 10),
          buffer_time: service.buffer_time ? parseInt(service.buffer_time, 10) : 0,
          price: service.price ? parseFloat(service.price) : 0.00,
          description: service.description?.trim() || null,
          fine_print: service.fine_print?.trim() || null,
          distribution: service.distribution?.trim() || null,
          shop_id: currentShop.id,
        })).filter(service => service.name && !isNaN(service.duration) && service.duration > 0);

        if (servicesToInsert.length === 0) {
          toast({ variant: 'destructive', title: 'Upload Error', description: 'No valid service data found in the file.' });
          return;
        }

        const { error } = await supabase.from('services').insert(servicesToInsert);
        if (error) throw error;

        toast({ title: 'Upload Successful!', description: `${servicesToInsert.length} services have been added.` });
        fetchServices();
      } catch (error) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'Could not parse or upload the file.' });
      } finally {
        event.target.value = null;
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <>
      <Helmet><title>Service Management</title></Helmet>
      <Layout>
        <div className="p-4 pb-24">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-4 justify-between items-center mb-6 pt-12">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Manage Services</h1>
                {systemHourlyRate !== null && systemHourlyRate > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    System Hourly Rate: <span className="font-semibold text-[#008000]">£{systemHourlyRate.toFixed(2)}/hour</span>
                  </p>
                )}
              </div>
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
              <Button variant="outline" onClick={handleOpenSettingsDialog} className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700">
                <Settings className="mr-2 h-4 w-4" /> Hourly Rate
              </Button>
              <Button variant="outline" onClick={handleOpenCategoriesDialog} className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700">
                <Tag className="mr-2 h-4 w-4" /> Categories
              </Button>
              <Button variant="outline" onClick={handleDownloadTemplate} className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700"><Download className="mr-2 h-4 w-4" /> Template</Button>
              <Button asChild variant="outline" className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700">
                <label>
                  <Upload className="mr-2 h-4 w-4" /> Upload
                  <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                </label>
              </Button>
              <Button onClick={() => handleOpenDialog()} className="bg-[#008000] hover:bg-[#006600] text-white">
                <Plus className="mr-2 h-4 w-4" /> Add Service
              </Button>
            </div>
          </motion.div>
          {!currentShop && !shopLoading ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-yellow-800">
                <MapPin className="w-5 h-5" />
                <p className="font-semibold">Please select a shop to view services</p>
              </div>
            </div>
          ) : null}
          {isLoading ? (
            <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-400" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {services.map(service => (
                <motion.div key={service.id} layout className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm space-y-3 flex flex-col">
                  <div className="flex-grow">
                    <h2 className="text-xl font-bold text-gray-900">{service.name}</h2>
                    {(service.category || service.subcategory) && (
                      <div className="flex items-center gap-2 text-purple-600 text-sm mt-1">
                        {service.category && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{service.category}</span>}
                        {service.subcategory && <span className="text-gray-600">• {service.subcategory}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-pink-600 mt-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration} min</span>
                      {service.buffer_time > 0 && (
                        <span className="text-gray-500 text-xs">+ {service.buffer_time} min buffer</span>
                      )}
                    </div>
                    {service.buffer_time > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Total: {service.duration + service.buffer_time} minutes
                      </div>
                    )}
                    {service.price > 0 && (
                      <div className="text-green-600 mt-1 font-semibold">
                        £{parseFloat(service.price).toFixed(2)}
                      </div>
                    )}
                    {service.description && (
                      <p className="text-gray-600 text-sm mt-2 line-clamp-2">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 pt-3 mt-auto">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(service)} className="flex-1 bg-white border-gray-200 hover:bg-gray-50 text-gray-700"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteService(service.id, service.name)} className="flex-1"><Trash className="mr-2 h-4 w-4" /> Delete</Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{editingService ? 'Edit' : 'Add'} Service</DialogTitle>
              <DialogDescription className="text-gray-600">
                Fill in the service details across all tabs. Required fields are marked with *.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-100 border border-gray-200">
                <TabsTrigger value="service" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Service & Pricing
                </TabsTrigger>
                <TabsTrigger value="description" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white">
                  <FileText className="w-4 h-4 mr-2" />
                  Description
                </TabsTrigger>
                <TabsTrigger value="fineprint" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Fine Print
                </TabsTrigger>
                <TabsTrigger value="distribution" className="data-[state=active]:bg-[#008000] data-[state=active]:text-white">
                  <Share2 className="w-4 h-4 mr-2" />
                  Distribution
                </TabsTrigger>
              </TabsList>

              {/* Service & Pricing Tab */}
              <TabsContent value="service" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Service Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    placeholder="e.g., Haircut, Manicure, Facial"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-gray-700">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200 text-gray-900">
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration" className="text-gray-700">Duration (minutes) *</Label>
                    <Input
                      id="duration"
                      name="duration"
                      type="number"
                      min="1"
                      value={formData.duration}
                      onChange={handleFormChange}
                      placeholder="30"
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="buffer_time" className="text-gray-700">Buffer Time (minutes)</Label>
                    <Input
                      id="buffer_time"
                      name="buffer_time"
                      type="number"
                      min="0"
                      value={formData.buffer_time}
                      onChange={handleFormChange}
                      placeholder="0"
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                {/* Total Duration Display */}
                {formData.duration && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total Duration:</span>
                      <span className="text-lg font-bold text-[#008000]">
                        {parseInt(formData.duration || 0) + parseInt(formData.buffer_time || 0)} minutes
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Service Duration ({formData.duration || 0} min) + Buffer Time ({formData.buffer_time || 0} min)
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="price" className="text-gray-700">Price (£)</Label>
                    {isPriceAutoCalculated && systemHourlyRate > 0 && (
                      <span className="text-xs text-[#008000] font-medium flex items-center gap-1">
                        <span className="w-2 h-2 bg-[#008000] rounded-full"></span>
                        Auto-calculated
                      </span>
                    )}
                  </div>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={handleFormChange}
                    placeholder="0.00"
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                  />
                  {systemHourlyRate > 0 ? (
                    <>
                      {isPriceAutoCalculated && (
                        <p className="text-xs text-gray-500">
                          Price is auto-calculated from system hourly rate (£{systemHourlyRate.toFixed(2)}/hour). Formula: (£{systemHourlyRate.toFixed(2)} / 60) × {formData.duration || 0} min = £{formData.price || '0.00'}
                        </p>
                      )}
                      {!isPriceAutoCalculated && formData.duration && (
                        <p className="text-xs text-gray-500">
                          System hourly rate: £{systemHourlyRate.toFixed(2)}/hour. Price will auto-calculate when you enter duration.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-amber-600">
                      No system hourly rate set. Click "Hourly Rate" button in the header to set it for auto-calculation.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* Description Tab */}
              <TabsContent value="description" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-gray-700">Service Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder="Provide a detailed description of the service. Include what the service includes, benefits, and any important details customers should know..."
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 min-h-[200px] resize-y"
                    rows={8}
                  />
                  <p className="text-xs text-gray-500">Describe what customers can expect from this service.</p>
                </div>
              </TabsContent>

              {/* Fine Print Tab */}
              <TabsContent value="fineprint" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="fine_print" className="text-gray-700">Fine Print / Terms & Conditions</Label>
                  <Textarea
                    id="fine_print"
                    name="fine_print"
                    value={formData.fine_print}
                    onChange={handleFormChange}
                    placeholder="Enter terms and conditions, cancellation policies, refund policies, or any important legal information customers should be aware of..."
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 min-h-[200px] resize-y"
                    rows={8}
                  />
                  <p className="text-xs text-gray-500">Add any terms, conditions, or important notices for this service.</p>
                </div>
              </TabsContent>

              {/* Distribution Tab */}
              <TabsContent value="distribution" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="distribution" className="text-gray-700">Distribution / Availability</Label>
                  <Textarea
                    id="distribution"
                    name="distribution"
                    value={formData.distribution}
                    onChange={handleFormChange}
                    placeholder="Specify where this service is available, which locations offer it, booking requirements, or any distribution/availability information..."
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 min-h-[200px] resize-y"
                    rows={8}
                  />
                  <p className="text-xs text-gray-500">Define where and how this service is distributed or made available.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button
                onClick={handleCloseDialog}
                variant="outline"
                className="flex-1 bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveService}
                disabled={isSaving || !formData.name || !formData.duration}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {editingService ? 'Update Service' : 'Add Service'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* System Hourly Rate Settings Dialog */}
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl">System Hourly Rate</DialogTitle>
              <DialogDescription className="text-gray-600">
                Set the system-wide hourly rate. This rate will be used to automatically calculate prices for all services based on their duration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="settings-hourly-rate" className="text-gray-700">Hourly Rate (£)</Label>
                <Input
                  id="settings-hourly-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsHourlyRate}
                  onChange={(e) => setSettingsHourlyRate(e.target.value)}
                  placeholder="e.g., 50.00"
                  className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                />
                <p className="text-xs text-gray-500">
                  This rate will be used to auto-calculate service prices. Formula: (Hourly Rate / 60) × Duration (in minutes)
                </p>
                {settingsHourlyRate && !isNaN(parseFloat(settingsHourlyRate)) && parseFloat(settingsHourlyRate) > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2">
                    <p className="text-xs text-gray-600 mb-1">Example calculations:</p>
                    <ul className="text-xs text-gray-500 space-y-0.5">
                      <li>30 min service: £{((parseFloat(settingsHourlyRate) / 60) * 30).toFixed(2)}</li>
                      <li>60 min service: £{((parseFloat(settingsHourlyRate) / 60) * 60).toFixed(2)}</li>
                      <li>90 min service: £{((parseFloat(settingsHourlyRate) / 60) * 90).toFixed(2)}</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button
                onClick={() => setIsSettingsDialogOpen(false)}
                variant="outline"
                className="flex-1 bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                disabled={isSavingSettings}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSystemHourlyRate}
                disabled={isSavingSettings || !settingsHourlyRate || isNaN(parseFloat(settingsHourlyRate)) || parseFloat(settingsHourlyRate) < 0}
                className="flex-1 bg-[#008000] hover:bg-[#006600] disabled:opacity-50 text-white"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Rate
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Service Categories Management Dialog */}
        <Dialog open={isCategoriesDialogOpen} onOpenChange={setIsCategoriesDialogOpen}>
          <DialogContent className="bg-white border-gray-200 text-gray-900 max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Manage Service Categories</DialogTitle>
              <DialogDescription className="text-gray-600">
                Add, edit, or remove service categories. Categories will appear in the dropdown when creating or editing services.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* Add/Edit Category Form */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="category-name" className="text-gray-700">Category Name *</Label>
                    <Input
                      id="category-name"
                      type="text"
                      value={categoryFormData.name}
                      onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Hair, Nails, Facial"
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category-description" className="text-gray-700">Description (Optional)</Label>
                    <Textarea
                      id="category-description"
                      value={categoryFormData.description}
                      onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of this category..."
                      className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSaveCategory}
                      disabled={isSavingCategory || !categoryFormData.name.trim()}
                      className="bg-[#008000] hover:bg-[#006600] disabled:opacity-50 text-white"
                    >
                      {isSavingCategory ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {editingCategory ? 'Update Category' : 'Add Category'}
                        </>
                      )}
                    </Button>
                    {editingCategory && (
                      <Button
                        onClick={() => {
                          setEditingCategory(null);
                          setCategoryFormData({ name: '', description: '' });
                        }}
                        variant="outline"
                        className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                      >
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Categories List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Existing Categories</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {categoryObjects.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {categories.length > 0
                        ? 'Categories are loaded but full details are not available. Run the SQL script to enable full management.'
                        : 'No categories found. Add your first category above.'}
                    </p>
                  ) : (
                    categoryObjects.map((category) => (
                      <div key={category.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">{category.name}</span>
                          {category.description && (
                            <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditCategory(category)}
                            className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteCategory(category)}
                          >
                            <Trash className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button
                onClick={() => {
                  setIsCategoriesDialogOpen(false);
                  setEditingCategory(null);
                  setCategoryFormData({ name: '', description: '' });
                }}
                variant="outline"
                className="flex-1 bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    </>
  );
};

export default ServiceManagement;