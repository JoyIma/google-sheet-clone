// components/SimpleShareDialog.tsx
import { useState, useEffect } from 'react';
import { X, Copy, Check, Mail, Users } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sheet: any;
}

type ShareRole = 'Editor' | 'Viewer';

export default function SimpleShareDialog({ isOpen, onClose, sheet }: ShareDialogProps) {
  const [shareLink, setShareLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [shareMethod, setShareMethod] = useState<'link' | 'email'>('link');
  const [selectedRole, setSelectedRole] = useState<ShareRole>('Viewer');
  const [emailToShare, setEmailToShare] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  
  // Generate share link when dialog opens
  useEffect(() => {
    if (isOpen && sheet) {
      generateShareLink();
      // Reset form when dialog opens
      setEmailToShare('');
      setShareStatus({ message: '', type: '' });
      setSelectedRole('Viewer');
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

  const handleEmailShare = async () => {
    if (!emailToShare.trim()) {
      setShareStatus({ message: 'Please enter an email address', type: 'error' });
      return;
    }

    if (!emailToShare.includes('@')) {
      setShareStatus({ message: 'Please enter a valid email address', type: 'error' });
      return;
    }

    setIsSharing(true);
    setShareStatus({ message: 'Assigning permissions...', type: '' });

    try {
      console.log('Sharing spreadsheet:', {
        email: emailToShare,
        spreadsheetId: sheet.id,
        role: selectedRole
      });

      // Step 1: First, ensure the user exists in Permit.io (sync them)
      const syncResponse = await fetch('/api/permit/sync-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: {
            id: emailToShare, // Use email as ID
            email: emailToShare,
            name: emailToShare.split('@')[0] // Basic name from email
          }
        }),
      });

      const syncResult = await syncResponse.json();
      if (!syncResult.success) {
        console.warn('User sync failed, but continuing with role assignment:', syncResult.error);
      }

      // Step 2: Assign the role to the user for this specific spreadsheet
      const assignResponse = await fetch('/api/permit/resource', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'assign-role',
          userId: emailToShare, // Use email as user ID
          spreadsheetId: sheet.id,
          role: selectedRole // "Editor" or "Viewer"
        }),
      });

      const assignResult = await assignResponse.json();

      if (assignResult.success) {
        setShareStatus({ 
          message: `✅ Successfully shared with ${emailToShare} as ${selectedRole}! They now have ${selectedRole.toLowerCase()} access to this spreadsheet.`, 
          type: 'success' 
        });
        setEmailToShare('');
        
        console.log('Role assignment successful:', assignResult.data);
      } else {
        throw new Error(assignResult.error || 'Failed to assign role');
      }
    } catch (error) {
      console.error('Error sharing spreadsheet:', error);
      setShareStatus({ 
        message: `❌ ${error instanceof Error ? error.message : 'Failed to share spreadsheet'}`, 
        type: 'error' 
      });
    } finally {
      setIsSharing(false);
    }
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

        {/* Share method tabs */}
        <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setShareMethod('link')}
            className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              shareMethod === 'link'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Copy className="w-4 h-4 mr-2" />
            Share Link
          </button>
          <button
            onClick={() => setShareMethod('email')}
            className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              shareMethod === 'email'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Mail className="w-4 h-4 mr-2" />
            Invite by Email
          </button>
        </div>

        {/* Role selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Access Level
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setSelectedRole('Viewer')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedRole === 'Viewer'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">Viewer</div>
              <div className="text-xs text-gray-500">Can view only</div>
            </button>
            <button
              onClick={() => setSelectedRole('Editor')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedRole === 'Editor'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">Editor</div>
              <div className="text-xs text-gray-500">Can view & edit</div>
            </button>
          </div>
        </div>

        {shareMethod === 'link' ? (
          /* Share link section */
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
              ⚠️ Note: Link sharing doesn't assign specific roles. Use "Invite by Email" to assign {selectedRole.toLowerCase()} permissions to specific users.
            </p>
          </div>
        ) : (
          /* Email invite section */
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="email"
                value={emailToShare}
                onChange={(e) => setEmailToShare(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleEmailShare();
                  }
                }}
              />
              <button
                onClick={handleEmailShare}
                disabled={isSharing || !emailToShare.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? 'Sharing...' : 'Share'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              They will receive {selectedRole.toLowerCase()} access to this spreadsheet
            </p>
          </div>
        )}

        {/* Status message */}
        {shareStatus.message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            shareStatus.type === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {shareStatus.message}
          </div>
        )}
        
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