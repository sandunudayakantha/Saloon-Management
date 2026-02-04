import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash, Save, Loader2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAlertDialog } from '@/contexts/AlertDialogContext';
import ImageUploader from '@/components/ImageUploader';
import { Textarea } from '@/components/ui/textarea';

const ProductsManagement = () => {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', image_url: '' });
  const { toast } = useToast();
  const { showDialog } = useAlertDialog();

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Error Fetching Products', description: error.message });
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
    setFormData(item ? { ...item } : { name: '', description: '', price: '', image_url: '' });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  const handleFormChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleImageUpload = (url) => setFormData(prev => ({ ...prev, image_url: url }));

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Product name and price are required.' });
      return;
    }
    setIsSaving(true);
    
    const { error } = await supabase.from('products').upsert({ ...formData, id: editingItem?.id });

    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
    } else {
      toast({ title: 'Success!', description: `Product has been ${editingItem ? 'updated' : 'created'}.` });
      handleCloseDialog();
      fetchItems();
    }
    setIsSaving(false);
  };

  const handleDelete = (item) => {
    showDialog({
      title: `Delete "${item.name}"?`,
      description: 'This action cannot be undone. Are you sure?',
      confirmText: 'Delete',
      onConfirm: async () => {
        const { error } = await supabase.from('products').delete().eq('id', item.id);
        if (error) {
          toast({ variant: 'destructive', title: 'Deletion Failed', description: error.message });
        } else {
          toast({ title: 'Product Deleted', description: `"${item.name}" has been removed.` });
          fetchItems();
        }
      },
    });
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-white">Products</h3>
        <Button onClick={() => handleOpenDialog()} className="bg-[#008000] hover:bg-[#006600] text-white">
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map(item => (
            <motion.div key={item.id} layout className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 flex flex-col">
              <img src={item.image_url || 'https://via.placeholder.com/400x300'} alt={item.name} className="w-full h-48 object-cover rounded-t-xl" />
              <div className="p-5 flex flex-col flex-grow">
                <h4 className="text-xl font-bold text-white">{item.name}</h4>
                <p className="text-gray-300 text-sm mt-1 flex-grow">{item.description}</p>
                <div className="flex items-center gap-2 text-pink-300 mt-3">
                  <DollarSign className="w-5 h-5" />
                  <span className="text-lg font-semibold">£{parseFloat(item.price).toFixed(2)}</span>
                </div>
                <div className="flex gap-2 pt-4 mt-auto">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(item)} className="flex-1 bg-white/10 border-white/20 hover:bg-white/20"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(item)} className="flex-1"><Trash className="mr-2 h-4 w-4" /> Delete</Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 border-white/20 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl">{editingItem ? 'Edit' : 'Add'} Product</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Product Image</Label><ImageUploader onUploadSuccess={handleImageUpload} initialImageUrl={formData.image_url} /></div>
            <div className="space-y-2"><Label>Name</Label><Input name="name" value={formData.name} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea name="description" value={formData.description} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <div className="space-y-2"><Label>Price</Label><Input name="price" type="number" value={formData.price} onChange={handleFormChange} className="bg-white/10 border-white/20" /></div>
            <Button onClick={handleSave} disabled={isSaving} className="w-full bg-green-600 hover:bg-green-700">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsManagement;