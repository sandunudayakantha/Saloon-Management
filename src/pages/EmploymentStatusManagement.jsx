import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Layout from '@/components/Layout';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlertDialog } from '@/contexts/AlertDialogContext';

const EmploymentStatusManagement = () => {
  const [statuses, setStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [formData, setFormData] = useState({ status_name: '' });
  const { toast } = useToast();
  const { showDialog } = useAlertDialog();

  const fetchStatuses = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('employment_statuses').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Error Fetching Statuses', description: error.message });
    } else {
      setStatuses(data);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleOpenDialog = (status = null) => {
    setEditingStatus(status);
    setFormData(status ? { status_name: status.status_name } : { status_name: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingStatus(null);
    setFormData({ status_name: '' });
  };

  const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSaveStatus = async () => {
    if (!formData.status_name) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Status name is required.' });
      return;
    }
    setIsSaving(true);

    const upsertData = { status_name: formData.status_name };
    let response;
    if (editingStatus) {
      response = await supabase.from('employment_statuses').update(upsertData).eq('id', editingStatus.id);
    } else {
      response = await supabase.from('employment_statuses').insert(upsertData);
    }

    const { error } = response;
    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
      toast({ title: 'Success!', description: `Status has been ${editingStatus ? 'updated' : 'created'}.` });
      handleCloseDialog();
      fetchStatuses();
    }
    setIsSaving(false);
  };

  const handleDeleteStatus = (status) => {
    showDialog({
      title: `Delete "${status.status_name}"?`,
      description: 'This will also remove the status from any team members assigned to it. This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('employment_statuses').delete().eq('id', status.id);
        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Status Deleted', description: `"${status.status_name}" has been removed.` });
          fetchStatuses();
        }
      },
    });
  };

  return (
    <>
      <Helmet><title>Manage Employment Statuses</title></Helmet>
      <Layout>
        <div className="p-4">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-6 pt-12">
            <h1 className="text-3xl font-bold text-gray-900">Manage Employment Statuses</h1>
            <Button onClick={() => handleOpenDialog()} className="bg-[#008000] hover:bg-[#006600] text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Status
            </Button>
          </motion.div>
          {isLoading ? (
            <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-600" /></div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <ul className="space-y-3">
                {statuses.map(status => (
                  <motion.li
                    key={status.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200"
                  >
                    <span className="font-medium text-gray-900">{status.status_name}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(status)} className="bg-white border-gray-200 text-gray-700 hover:bg-white/20"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteStatus(status)}><Trash className="mr-2 h-4 w-4" /> Delete</Button>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="bg-white border-gray-200 text-gray-900">
            <DialogHeader><DialogTitle className="text-2xl">{editingStatus ? 'Edit' : 'Add'} Status</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status_name">Status Name</Label>
                <Input id="status_name" name="status_name" value={formData.status_name} onChange={handleFormChange} className="bg-white border-gray-200 text-gray-700" />
              </div>
              <Button onClick={handleSaveStatus} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-700">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save Status'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Layout>
    </>
  );
};

export default EmploymentStatusManagement;