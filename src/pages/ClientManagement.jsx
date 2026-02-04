import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Save, Phone, Mail, MapPin, Loader2, Download, Upload, Calendar, DollarSign, Clock, ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/components/Layout';
import { useToast } from '@/components/ui/use-toast';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import { useShop } from '@/contexts/ShopContext';
import { utils, writeFile, read } from 'xlsx';
import { format, parseISO } from 'date-fns';

const ClientManagement = () => {
  const [clients, setClients] = useState([]);
  const [clientsWithHistory, setClientsWithHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [expandedClient, setExpandedClient] = useState(null);
  const [clientHistory, setClientHistory] = useState({});
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', address: '' });
  const { toast } = useToast();
  const { showDialog } = useAlertDialog();
  const { currentShop, shops, setCurrentShop, loading: shopLoading } = useShop();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const highlightClientId = queryParams.get('highlight');

  const fetchClients = useCallback(async () => {
    if (!currentShop) {
      setIsLoading(false);
      setClients([]);
      setClientsWithHistory([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch clients for current shop
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('shop_id', currentShop.id)
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Fetch appointment history for each client
      const clientsWithStats = await Promise.all(
        (clientsData || []).map(async (client) => {
          // Get last appointment (filtered by shop)
          const { data: lastAppointment } = await supabase
            .from('appointments')
            .select('*, services(name), team_members(name)')
            .eq('client_id', client.id)
            .eq('shop_id', currentShop.id)
            .eq('type', 'appointment')
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get total spending and appointment count (filtered by shop)
          const { data: appointmentsData } = await supabase
            .from('appointments')
            .select('price, start_time')
            .eq('client_id', client.id)
            .eq('shop_id', currentShop.id)
            .eq('type', 'appointment');

          const totalSpent = appointmentsData?.reduce((sum, apt) => sum + (parseFloat(apt.price) || 0), 0) || 0;
          const totalAppointments = appointmentsData?.length || 0;
          const lastVisitDate = lastAppointment?.start_time || null;

          return {
            ...client,
            lastAppointment: lastAppointment || null,
            lastVisitDate: lastVisitDate,
            totalSpent: totalSpent,
            totalAppointments: totalAppointments,
          };
        })
      );

      setClients(clientsData || []);
      setClientsWithHistory(clientsWithStats);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Fetching Clients',
        description: error.message,
      });
      setClients([]);
      setClientsWithHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentShop]);

  const fetchClientFullHistory = useCallback(async (clientId) => {
    if (clientHistory[clientId] || !currentShop) {
      return; // Already fetched or no shop selected
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services(name, duration),
          team_members(name),
          shops(name)
        `)
        .eq('client_id', clientId)
        .eq('shop_id', currentShop.id)
        .eq('type', 'appointment')
        .order('start_time', { ascending: false })
        .limit(10);

      if (error) throw error;

      setClientHistory(prev => ({
        ...prev,
        [clientId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching client history:', error);
    }
  }, [clientHistory, currentShop]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (highlightClientId && clients.length > 0) {
      const element = document.getElementById(`client-${highlightClientId}`);
      if (element) {
        toast({
          title: "Client Found! ✨",
          description: "Highlighted client in the list below.",
        });
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('animate-pulse', 'border-pink-500');
        setTimeout(() => {
          element.classList.remove('animate-pulse', 'border-pink-500');
        }, 3000);
      }
    }
  }, [highlightClientId, clients, toast]);

  const handleOpenDialog = (client = null) => {
    setEditingClient(client);
    setFormData(client ? { name: client.name, email: client.email || '', phone: client.phone || '', address: client.address || '' } : { name: '', email: '', phone: '', address: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    setFormData({ name: '', email: '', phone: '', address: '' });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveClient = async () => {
    if (!formData.name) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Client name is required.' });
      return;
    }
    if (!currentShop) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
      return;
    }
    setIsSaving(true);

    const clientData = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      shop_id: currentShop.id,
    };

    let response;
    if (editingClient) {
      response = await supabase.from('clients').update(clientData).eq('id', editingClient.id).eq('shop_id', currentShop.id);
    } else {
      response = await supabase.from('clients').insert(clientData);
    }

    const { error } = response;

    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
      toast({ title: 'Success!', description: `Client has been ${editingClient ? 'updated' : 'created'}.` });
      handleCloseDialog();
      fetchClients();
    }
    setIsSaving(false);
  };

  const handleDeleteClient = (client) => {
    if (!currentShop) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a shop first.' });
      return;
    }
    showDialog({
      title: `Delete "${client.name}"?`,
      description: 'This action cannot be undone. Are you sure you want to permanently delete this client?',
      confirmText: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('clients').delete().eq('id', client.id).eq('shop_id', currentShop.id);
        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Client Deleted', description: `"${client.name}" has been removed.` });
          fetchClients();
        }
      },
    });
  };

    const handleDownloadTemplate = () => {
        const templateData = [{ 
            name: 'John Doe', 
            email: 'john.doe@example.com', 
            phone: '123-456-7890', 
            address: '123 Main St',
            total_spent: 0.00 // This will be calculated automatically from appointments
        }];
        const worksheet = utils.json_to_sheet(templateData);
        
        // Set column widths for better readability
        worksheet['!cols'] = [
            { wch: 25 }, // name
            { wch: 30 }, // email
            { wch: 15 }, // phone
            { wch: 30 }, // address
            { wch: 15 }  // total_spent
        ];
        
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, "Clients");
        writeFile(workbook, "clients_template.xlsx");
        toast({ 
            title: "Template downloaded", 
            description: "Fill it out and upload to add clients. Note: total_spent is calculated automatically from appointments." 
        });
    };

    const handleExportClients = async () => {
        try {
            // Export clients with their spending data
            const exportData = clientsWithHistory.map(client => ({
                name: client.name,
                email: client.email || '',
                phone: client.phone || '',
                address: client.address || '',
                total_spent: client.totalSpent || 0.00,
                total_appointments: client.totalAppointments || 0,
                last_visit: client.lastVisitDate ? format(parseISO(client.lastVisitDate), 'MMM d, yyyy') : ''
            }));

            const worksheet = utils.json_to_sheet(exportData);
            
            // Set column widths
            worksheet['!cols'] = [
                { wch: 25 }, // name
                { wch: 30 }, // email
                { wch: 15 }, // phone
                { wch: 30 }, // address
                { wch: 15 }, // total_spent
                { wch: 18 }, // total_appointments
                { wch: 20 }  // last_visit
            ];
            
            const workbook = utils.book_new();
            utils.book_append_sheet(workbook, worksheet, "Clients");
            writeFile(workbook, `clients_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
            toast({ 
                title: "Export successful!", 
                description: `Exported ${exportData.length} clients with spending data.` 
            });
        } catch (error) {
            toast({ 
                variant: 'destructive', 
                title: 'Export failed', 
                description: error.message 
            });
        }
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

                const clientsToInsert = jsonData.map(client => ({
                    name: client.name,
                    email: client.email || null,
                    phone: client.phone ? String(client.phone) : null,
                    address: client.address || null,
                    shop_id: currentShop.id,
                })).filter(client => client.name);

                if (clientsToInsert.length === 0) {
                    toast({ variant: 'destructive', title: 'Upload Error', description: 'No valid client data found in the file.' });
                    return;
                }
                
                const { error } = await supabase.from('clients').insert(clientsToInsert);
                if (error) throw error;
                
                toast({ title: 'Upload Successful!', description: `${clientsToInsert.length} clients have been added.` });
                fetchClients();
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
      <Helmet><title>Client Management</title></Helmet>
      <Layout>
        <div className="p-4 pb-24">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-4 justify-between items-center mb-6 pt-12">
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">Manage Clients</h1>
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
                <Button variant="outline" onClick={handleDownloadTemplate} className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700"><Download className="mr-2 h-4 w-4" /> Template</Button>
                <Button variant="outline" onClick={handleExportClients} className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700" disabled={isLoading || clientsWithHistory.length === 0}>
                  <FileDown className="mr-2 h-4 w-4" /> Export
                </Button>
                <Button asChild variant="outline" className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700">
                  <label>
                    <Upload className="mr-2 h-4 w-4" /> Upload
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                  </label>
                </Button>
                <Button onClick={() => handleOpenDialog()} className="bg-[#008000] hover:bg-[#006600] text-white">
                  <Plus className="mr-2 h-4 w-4" /> Add Client
                </Button>
            </div>
          </motion.div>
          {!currentShop && !shopLoading ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-yellow-800">
                <MapPin className="w-5 h-5" />
                <p className="font-semibold">Please select a shop to view clients</p>
              </div>
            </div>
          ) : null}
          {isLoading ? (
            <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-400" /></div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold text-gray-900">Name</TableHead>
                      <TableHead className="font-semibold text-gray-900">Contact</TableHead>
                      <TableHead className="font-semibold text-gray-900">Address</TableHead>
                      <TableHead className="font-semibold text-gray-900">Last Visit</TableHead>
                      <TableHead className="font-semibold text-gray-900">Total Spent</TableHead>
                      <TableHead className="font-semibold text-gray-900">Appointments</TableHead>
                      <TableHead className="font-semibold text-gray-900">History</TableHead>
                      <TableHead className="font-semibold text-gray-900 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsWithHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-gray-500">
                          No clients found. Click "Add Client" to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientsWithHistory.map(client => {
                        const isExpanded = expandedClient === client.id;
                        const history = clientHistory[client.id] || [];

                        return (
                          <React.Fragment key={client.id}>
                            <TableRow
                  id={`client-${client.id}`}
                              className={`hover:bg-gray-50 transition-colors ${highlightClientId === client.id ? 'bg-pink-50 border-l-4 border-l-pink-500' : ''}`}
                            >
                              <TableCell className="font-semibold text-gray-900">
                                {client.name}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {client.email && (
                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                      <Mail className="w-3.5 h-3.5" />
                                      <span className="truncate max-w-[200px]">{client.email}</span>
                                    </div>
                                  )}
                                  {client.phone && (
                                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                      <Phone className="w-3.5 h-3.5" />
                                      <span>{client.phone}</span>
                                    </div>
                                  )}
                                  {!client.email && !client.phone && (
                                    <span className="text-gray-400 text-sm">No contact info</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {client.address ? (
                                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate max-w-[200px]">{client.address}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {client.lastVisitDate ? (
                                  <div className="flex items-center gap-1.5 text-sm text-pink-600">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{format(parseISO(client.lastVisitDate), 'MMM d, yyyy')}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">Never</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>£{client.totalSpent.toFixed(2)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-700">
                                  {client.totalAppointments || 0}
                                </span>
                              </TableCell>
                              <TableCell>
                                {client.totalAppointments > 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (!isExpanded) {
                                        fetchClientFullHistory(client.id);
                                      }
                                      setExpandedClient(isExpanded ? null : client.id);
                                    }}
                                    className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="w-3 h-3 mr-1" />
                                        Hide
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3 mr-1" />
                                        View
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleOpenDialog(client)} 
                                    className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => handleDeleteClient(client)}
                                  >
                                    <Trash className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && client.totalAppointments > 0 && (
                              <TableRow>
                                <TableCell colSpan={8} className="bg-gray-50 p-4">
                                  <div className="space-y-2">
                                    <div className="text-sm font-semibold text-gray-700 mb-3">Appointment History</div>
                                    {history.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {history.map((apt) => (
                                          <div key={apt.id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                                            <div className="flex justify-between items-start">
                                              <div className="flex-1">
                                                <div className="text-gray-900 font-medium text-sm">{apt.services?.name || 'Service'}</div>
                                                <div className="text-gray-600 text-xs mt-1">
                                                  {format(parseISO(apt.start_time), 'MMM d, yyyy h:mm a')}
                                                </div>
                                                {apt.team_members?.name && (
                                                  <div className="text-gray-500 text-xs mt-1">with {apt.team_members.name}</div>
                                                )}
                                              </div>
                                              {apt.price > 0 && (
                                                <div className="text-green-600 font-semibold text-sm ml-2">
                                                  £{parseFloat(apt.price).toFixed(2)}
                                                </div>
                                              )}
                  </div>
                  </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-gray-500 text-sm text-center py-4">Loading history...</div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="bg-white border-gray-200 text-gray-900 max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-2xl">{editingClient ? 'Edit' : 'Add'} Client</DialogTitle></DialogHeader>
            <div className="space-y-4">
                <div className="space-y-2"><Label htmlFor="name" className="text-gray-700">Client Name</Label><Input id="name" name="name" value={formData.name} onChange={handleFormChange} className="bg-white border-gray-300 text-gray-900" /></div>
                <div className="space-y-2"><Label htmlFor="email" className="text-gray-700">Email</Label><Input id="email" name="email" type="email" value={formData.email} onChange={handleFormChange} className="bg-white border-gray-300 text-gray-900" /></div>
                <div className="space-y-2"><Label htmlFor="phone" className="text-gray-700">Phone</Label><Input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleFormChange} className="bg-white border-gray-300 text-gray-900" /></div>
                <div className="space-y-2"><Label htmlFor="address" className="text-gray-700">Address</Label><Input id="address" name="address" value={formData.address} onChange={handleFormChange} className="bg-white border-gray-300 text-gray-900" /></div>
              <Button onClick={handleSaveClient} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-700 text-white">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Client'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    </>
  );
};

export default ClientManagement;