import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Save, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

const OffersManagement = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', start_date: '', end_date: '' });
  const { toast } = useToast();
  const { showDialog } = useAlertDialog();

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('offers').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Error Fetching Offers', description: error.message });
    } else {
      setItems(data);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenDialog = (item = null) => {
    setEditingItem(item);
    const SANE_DATE_FORMAT = "yyyy-MM-dd'T'HH:mm";
    setFormData(item ? { 
        ...item,
        start_date: item.start_date ? format(new Date(item.start_date), SANE_DATE_FORMAT) : '',
        end_date: item.end_date ? format(new Date(item.end_date), SANE_DATE_FORMAT) : '',
    } : { title: '', description: '', start_date: '', end_date: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => setIsDialogOpen(false);
  const handleFormChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!formData.title) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Offer title is required.' });
      return;
    }
    setIsSaving(true);
    
    const dataToSave = {
        ...formData,
        id: editingItem?.id,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
    };

    const { error } = await supabase.from('offers').upsert(dataToSave);

    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
      toast({ title: 'Success!', description: `Offer has been ${editingItem ? 'updated' : 'created'}.` });
      handleCloseDialog();
      fetchItems();
    }
    setIsSaving(false);
  };

  const handleDelete = (item) => {
    showDialog({
      title: `Delete "${item.title}"?`,
      description: 'This action cannot be undone. Are you sure?',
      confirmText: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('offers').delete().eq('id', item.id);
        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Offer Deleted', description: `"${item.title}" has been removed.` });
          fetchItems();
        }
      },
    });
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-white">Offers</h3>
        <Button onClick={() => handleOpenDialog()} className="bg-[#008000] hover:bg-[#006600] text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Offer
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <motion.div key={item.id} layout className="bg-white/10 backdrop-blur-lg rounded-xl p-5 border border-white/20 flex flex-col">
              <div className="flex-grow">
                <h4 className="text-xl font-bold text-white">{item.title}</h4>
                <p className="text-gray-300 text-sm mt-1 flex-grow">{item.description}</p>
                <div className="flex items-center gap-2 text-pink-300 mt-3 text-xs">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{item.start_date ? format(new Date(item.start_date), 'PPP') : 'N/A'}</span>
                  <span>-</span>
                  <span>{item.end_date ? format(new Date(item.end_date), 'PPP') : 'N/A'}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-4 mt-auto">
                <Button variant="outline" size="sm" onClick={() => handleOpenDialog(item)} className="flex-1 bg-white/10 border-white/20 hover:bg-white/20"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(item)} className="flex-1"><Trash className="mr-2 h-4 w-4" /> Delete</Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 border-white/20 text-white">
          <DialogHeader><DialogTitle className="text-2xl">{editingItem ? 'Edit' : 'Add'} Offer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input name="title" value={formData.title} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea name="description" value={formData.description} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Start Date</Label><Input name="start_date" type="datetime-local" value={formData.start_date} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
                <div className="space-y-2"><Label>End Date</Label><Input name="end_date" type="datetime-local" value={formData.end_date} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-700">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Offer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OffersManagement;