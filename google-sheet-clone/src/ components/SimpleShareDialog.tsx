// components/SimpleShareDialog.tsx
import { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function SimpleShareDialog({ isOpen, onClose, sheet }) {
  const [shareLink, setShareLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  
  // Generate share link when dialog opens
  useEffect(() => {
    if (isOpen && sheet) {
      generateShareLink();
    }
  }, [isOpen, sheet]);
  
  const generateShareLink = () => {
    if (!sheet) return;
    
    // Create a shareable link
    const baseUrl = window.location.origin;
    setShareLink(`${baseUrl}/spreadsheet/${sheet.id}`);
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setIsCopied(true);
    
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Share "{sheet?.name}"</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Share link */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Share link
          </label>
          <div className="flex items-center">
            <input
              type="text"
              value={shareLink}
              readOnly
              className="flex-1 rounded-l-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2"
            />
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 shadow-sm text-sm font-medium rounded-r-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Anyone with the link can access and edit this spreadsheet
          </p>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}