import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Save, Loader2, Percent, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import { format } from 'date-fns';

const DiscountsManagement = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ code: '', percentage: '', valid_until: '' });
  const { toast } = useToast();
  const { showDialog } = useAlertDialog();

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('discounts').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Error Fetching Discounts', description: error.message });
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
        valid_until: item.valid_until ? format(new Date(item.valid_until), SANE_DATE_FORMAT) : '',
    } : { code: '', percentage: '', valid_until: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => setIsDialogOpen(false);
  const handleFormChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!formData.code || !formData.percentage) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Code and percentage are required.' });
      return;
    }
    setIsSaving(true);
    
    const dataToSave = {
        ...formData,
        id: editingItem?.id,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
    };

    const { error } = await supabase.from('discounts').upsert(dataToSave);

    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
      toast({ title: 'Success!', description: `Discount has been ${editingItem ? 'updated' : 'created'}.` });
      handleCloseDialog();
      fetchItems();
    }
    setIsSaving(false);
  };

  const handleDelete = (item) => {
    showDialog({
      title: `Delete "${item.code}"?`,
      description: 'This action cannot be undone. Are you sure?',
      confirmText: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('discounts').delete().eq('id', item.id);
        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Discount Deleted', description: `"${item.code}" has been removed.` });
          fetchItems();
        }
      },
    });
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-white">Discounts</h3>
        <Button onClick={() => handleOpenDialog()} className="bg-[#008000] hover:bg-[#006600] text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Discount
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <motion.div key={item.id} layout className="bg-white/10 backdrop-blur-lg rounded-xl p-5 border border-white/20 flex flex-col">
              <div className="flex-grow">
                <h4 className="text-2xl font-mono font-bold text-white bg-white/10 px-3 py-1 rounded-md inline-block">{item.code}</h4>
                <div className="flex items-center gap-2 text-pink-300 mt-3">
                  <Percent className="w-5 h-5" />
                  <span className="text-lg font-semibold">{parseFloat(item.percentage).toFixed(2)}% OFF</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 mt-2 text-xs">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Valid until: {item.valid_until ? format(new Date(item.valid_until), 'PPP') : 'No expiry'}</span>
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
          <DialogHeader><DialogTitle className="text-2xl">{editingItem ? 'Edit' : 'Add'} Discount</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Discount Code</Label><Input name="code" value={formData.code} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <div className="space-y-2"><Label>Percentage</Label><Input name="percentage" type="number" value={formData.percentage} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <div className="space-y-2"><Label>Valid Until</Label><Input name="valid_until" type="datetime-local" value={formData.valid_until} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <Button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-700">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Discount'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscountsManagement;