// src/app/dashboard/page.tsx
"use client"

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, FileSpreadsheet, LogOut, User, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [creationStatus, setCreationStatus] = useState({ message: '', type: '' });
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchUserSheets(session.user.id);
      } else {
        router.push('/login-signup');
      }
    };
    
    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        fetchUserSheets(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSheets([]);
        router.push('/login-signup');
      }
    });
    
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [router]);
  
  const fetchUserSheets = async (userId) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sheets')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
        
      if (error) throw error;
      console.log('Fetched sheets:', data);
      setSheets(data || []);
    } catch (error) {
      console.error('Error fetching sheets:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const createNewSheet = async () => {
    if (!user) return;
    
    try {
      setCreationStatus({ message: 'Creating sheet...', type: 'info' });
      const name = newSheetName.trim() || `Untitled Sheet ${new Date().toLocaleString()}`;
      
      // Log the data we're about to send
      console.log('Creating sheet with data:', {
        name,
        user_id: user.id,
        cells: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const { data, error } = await supabase
        .from('sheets')
        .insert([
          { 
            name: name, 
            user_id: user.id,
            cells: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select();
        
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Sheet created successfully:', data);
      
      if (data && data.length > 0) {
        setSheets([data[0], ...sheets]);
        setNewSheetName('');
        setIsCreatingSheet(false);
        setCreationStatus({ message: 'Sheet created successfully!', type: 'success' });
        
        // Redirect to the sheet editor after a short delay
        setTimeout(() => {
          router.push(`/spreadsheet/${data[0].id}`);
        }, 1000);
      }
    } catch (error) {
      console.error('Error creating new sheet:', error);
      setCreationStatus({ 
        message: `Error creating sheet: ${error.message || 'Unknown error'}`, 
        type: 'error' 
      });
    }
  };
  
  const deleteSheet = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this sheet?')) return;
    
    try {
      const { error } = await supabase
        .from('sheets')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setSheets(sheets.filter(sheet => sheet.id !== id));
    } catch (error) {
      console.error('Error deleting sheet:', error);
    }
  };
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login-signup');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <FileSpreadsheet className="h-8 w-8 text-green-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">My Sheets</h1>
            </div>
            <div className="flex items-center">
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center text-sm px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100"
                >
                  <User className="w-5 h-5 mr-1" />
                  <span>{user?.email}</span>
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <button 
                      onClick={handleSignOut}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">All Sheets</h2>
            <button
              onClick={() => setIsCreatingSheet(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Sheet
            </button>
          </div>

          {/* Sheet creation form */}
          {isCreatingSheet && (
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="Sheet name (optional)"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2"
                  autoFocus
                />
                <button
                  onClick={createNewSheet}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Create
                </button>
                <button
                  onClick={() => setIsCreatingSheet(false)}
                  className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
              </div>
              
              {/* Status message */}
              {creationStatus.message && (
                <div className={`mt-2 p-2 text-sm rounded ${
                  creationStatus.type === 'error' 
                    ? 'bg-red-50 text-red-600' 
                    : creationStatus.type === 'success'
                      ? 'bg-green-50 text-green-600'
                      : 'bg-blue-50 text-blue-600'
                }`}>
                  {creationStatus.message}
                </div>
              )}
            </div>
          )}

          {/* Sheets grid */}
          <div className="p-6">
            {sheets.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No sheets yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new sheet.</p>
                <div className="mt-6">
                  <button
                    onClick={() => setIsCreatingSheet(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Sheet
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sheets.map((sheet) => (
                  <Link 
                    href={`/spreadsheet/${sheet.id}`}
                    key={sheet.id}
                    className="relative block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <FileSpreadsheet className="h-8 w-8 text-green-600" />
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-gray-900">{sheet.name}</h3>
                          <p className="text-xs text-gray-500">
                            Last edited: {new Date(sheet.updated_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => deleteSheet(sheet.id, e)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <span className="sr-only">Delete</span>
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;