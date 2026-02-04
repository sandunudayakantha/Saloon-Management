import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient'; // Ensure this is imported

const ImageUploader = ({ onUploadSuccess, initialImageUrl }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(initialImageUrl || null);
  const { toast } = useToast();

  // Update preview when initialImageUrl changes
  useEffect(() => {
    setPreview(initialImageUrl || null);
  }, [initialImageUrl]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please select an image smaller than 10MB.',
      });
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please select a valid image file (JPEG, PNG, GIF, or WebP).',
      });
      return;
    }

    setUploading(true);

    try {
        // Generate unique filename with timestamp and random string
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const fileName = `profile_${timestamp}_${randomStr}.${fileExt}`;
        const filePath = fileName;
        
        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('TeamMemberProfile')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false // Set to true if you want to overwrite existing files
            });

        if (uploadError) {
            // Handle specific error cases
            if (uploadError.message?.includes('Bucket not found') || uploadError.statusCode === '404') {
                toast({
                    variant: 'destructive',
                    title: 'Storage Bucket Not Found',
                    description: 'Please ensure the "TeamMemberProfile" bucket exists in Supabase Storage.',
                });
                setUploading(false);
                return;
            }
            
            // Handle RLS policy errors - try to provide helpful error message
            if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('violates row-level security') || uploadError.statusCode === '403' || uploadError.statusCode === 403) {
                console.error('Storage RLS Error:', uploadError);
                toast({
                    variant: 'destructive',
                    title: 'Upload Permission Denied',
                    description: 'Storage bucket RLS policies are blocking upload. Please configure Supabase Storage policies for "TeamMemberProfile" bucket to allow authenticated users to upload.',
                });
                setUploading(false);
                return;
            }
            
            if (uploadError.message?.includes('already exists')) {
                // If file exists, try with a new name
                const newFileName = `profile_${timestamp}_${randomStr}_${Date.now()}.${fileExt}`;
                const { data: retryData, error: retryError } = await supabase.storage
                    .from('TeamMemberProfile')
                    .upload(newFileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (retryError) {
                    // If retry also fails with RLS error, show error message
                    if (retryError.message?.includes('row-level security') || retryError.statusCode === '403' || retryError.statusCode === 403) {
                        console.error('Storage RLS Error on retry:', retryError);
                        toast({
                            variant: 'destructive',
                            title: 'Upload Permission Denied',
                            description: 'Storage bucket RLS policies are blocking upload. Please configure Supabase Storage policies for "TeamMemberProfile" bucket.',
                        });
                        setUploading(false);
                        return;
                    }
                    throw retryError;
                }
                
                const { data: urlData } = supabase.storage
                    .from('TeamMemberProfile')
                    .getPublicUrl(newFileName);
                
                setPreview(urlData.publicUrl);
                onUploadSuccess(urlData.publicUrl);
                toast({
                    title: 'Image Uploaded! ✨',
                    description: 'The new image has been successfully saved.',
                });
                setUploading(false);
                return;
            }
            
            throw uploadError;
        }

        // Get public URL for the uploaded file
        const { data: urlData, error: urlError } = supabase.storage
            .from('TeamMemberProfile')
            .getPublicUrl(uploadData.path);

        if (urlError) {
            console.error('Error getting public URL:', urlError);
            toast({
                variant: 'destructive',
                title: 'Upload Complete',
                description: 'Image uploaded but failed to get public URL. Please check Supabase Storage configuration.',
            });
            setUploading(false);
            return;
        }

        const publicUrl = urlData?.publicUrl;

        if (!publicUrl) {
            toast({
                variant: 'destructive',
                title: 'Upload Error',
                description: 'Failed to generate public URL for uploaded image.',
            });
            setUploading(false);
            return;
        }

        setPreview(publicUrl);
        onUploadSuccess(publicUrl);

        toast({
            title: 'Image Uploaded Successfully! ✨',
            description: `Image has been uploaded to TeamMemberProfile bucket: ${uploadData.path}`,
        });
    } catch (error) {
        console.error('Upload error:', error);
        toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: error.message || 'There was a problem uploading your image. Please try again.',
        });
    } finally {
        setUploading(false);
    }
  }, [onUploadSuccess, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.gif', '.jpg'] },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`relative w-full h-48 border-2 border-dashed rounded-xl flex items-center justify-center text-center p-4 cursor-pointer transition-colors ${
        isDragActive ? 'border-[#008000] bg-[#008000]/10' : 'border-gray-300 hover:border-[#008000] bg-gray-50'
      }`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="flex flex-col items-center gap-2 text-gray-600">
          <Loader2 className="w-8 h-8 animate-spin text-[#008000]" />
          <p className="text-gray-700">Uploading...</p>
        </div>
      ) : preview ? (
        <>
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-full object-contain rounded-lg" 
            onError={(e) => {
              e.target.style.display = 'none';
              setPreview(null);
              toast({
                variant: 'destructive',
                title: 'Image Load Error',
                description: 'Failed to load image. Please try uploading again.',
              });
            }}
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg">
            <p className="text-white font-semibold">Click or drag to replace</p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-600">
          <UploadCloud className="w-8 h-8 text-gray-400" />
          <p className="text-gray-700">
            {isDragActive
              ? 'Drop the image here...'
              : "Drag 'n' drop an image, or click to select"}
          </p>
          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;