"use client"

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '../../../utils/supabase/client';
import { Save, Share2, Download, Trash2, Plus, FileSpreadsheet, Menu, User, LogOut } from 'lucide-react';

// Initialize Supabase client from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const SpreadsheetApp = () => {
  // State management
  const [user, setUser] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [currentSheet, setCurrentSheet] = useState(null);
  const [data, setData] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [cellValues, setCellValues] = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  
  const gridRef = useRef(null);
  const cellInputRef = useRef(null);
  
  // Generate initial empty data
  const generateEmptySheet = () => {
    const rows = 100;
    const cols = 26; // A-Z
    return {
      name: 'Untitled Sheet',
      rows,
      cols,
      cells: {}
    };
  };
  
  // Column header labels (A, B, C, etc.)
  const columnLabels = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  
  // Check user session on component mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        fetchUserSheets(session.user.id);
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
        setCurrentSheet(null);
      }
    });
    
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);
  
  // Fetch user's sheets from Supabase
  const fetchUserSheets = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('sheets')
        .select('*')
        .eq('user_id', userId);
        
      if (error) throw error;
      
      setSheets(data || []);
      if (data && data.length > 0) {
        setCurrentSheet(data[0]);
        setCellValues(data[0].cells || {});
      } else {
        // Create a new sheet if user has none
        createNewSheet(userId);
      }
    } catch (error) {
      console.error('Error fetching sheets:', error);
    }
  };
  
  // Create a new sheet
  const createNewSheet = async (userId) => {
    try {
      const newSheet = generateEmptySheet();
      
      const { data, error } = await supabase
        .from('sheets')
        .insert([
          { 
            name: newSheet.name, 
            user_id: userId,
            cells: {},
            created_at: new Date(),
            updated_at: new Date()
          }
        ])
        .select();
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        setSheets([...sheets, data[0]]);
        setCurrentSheet(data[0]);
        setCellValues({});
      }
    } catch (error) {
      console.error('Error creating new sheet:', error);
    }
  };
  
  // Save current sheet to Supabase
  const saveSheet = async () => {
    if (!currentSheet) return;
    
    try {
      const { error } = await supabase
        .from('sheets')
        .update({ 
          cells: cellValues,
          updated_at: new Date()
        })
        .eq('id', currentSheet.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Error saving sheet:', error);
    }
  };
  
  // Delete current sheet
  const deleteSheet = async () => {
    if (!currentSheet) return;
    
    try {
      const { error } = await supabase
        .from('sheets')
        .delete()
        .eq('id', currentSheet.id);
        
      if (error) throw error;
      
      const updatedSheets = sheets.filter(sheet => sheet.id !== currentSheet.id);
      setSheets(updatedSheets);
      
      if (updatedSheets.length > 0) {
        setCurrentSheet(updatedSheets[0]);
        setCellValues(updatedSheets[0].cells || {});
      } else {
        createNewSheet(user.id);
      }
    } catch (error) {
      console.error('Error deleting sheet:', error);
    }
  };
  
  // Handle cell selection
  const handleCellClick = (rowIndex, colIndex) => {
    setSelectedCell({ row: rowIndex, col: colIndex });
    
    // Focus the input when a cell is selected
    if (cellInputRef.current) {
      cellInputRef.current.focus();
    }
  };
  
  // Handle cell value change
  const handleCellChange = (e) => {
    const cellId = `${selectedCell.row}-${selectedCell.col}`;
    const newValues = { ...cellValues };
    newValues[cellId] = e.target.value;
    setCellValues(newValues);
  };
  
  // Get cell value
  const getCellValue = (rowIndex, colIndex) => {
    const cellId = `${rowIndex}-${colIndex}`;
    return cellValues[cellId] || '';
  };
  
  // Handle sharing sheet with another user
  const handleShareSheet = async () => {
    if (!currentSheet || !shareEmail) return;
    
    try {
      // First, check if user exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', shareEmail)
        .single();
        
      if (userError || !userData) {
        alert('User not found');
        return;
      }
      
      // Create sharing permission in Supabase
      const { error } = await supabase
        .from('sheet_permissions')
        .insert([
          { 
            sheet_id: currentSheet.id, 
            user_id: userData.id,
            permission: 'read',
            created_at: new Date()
          }
        ]);
        
      if (error) throw error;
      
      alert(`Sheet shared with ${shareEmail}`);
      setIsSharing(false);
      setShareEmail('');
    } catch (error) {
      console.error('Error sharing sheet:', error);
    }
  };
  
  // Export sheet as CSV
  const exportAsCSV = () => {
    if (!currentSheet) return;
    
    // Find the maximum row and column indices
    let maxRow = 0;
    let maxCol = 0;
    
    Object.keys(cellValues).forEach(cellId => {
      const [row, col] = cellId.split('-').map(Number);
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);
    });
    
    // Generate CSV content
    let csvContent = '';
    
    for (let i = 0; i <= maxRow; i++) {
      const rowValues = [];
      
      for (let j = 0; j <= maxCol; j++) {
        const cellValue = getCellValue(i, j);
        // Escape commas and quotes in cell values
        const escapedValue = cellValue.includes(',') || cellValue.includes('"') 
          ? `"${cellValue.replace(/"/g, '""')}"` 
          : cellValue;
        rowValues.push(escapedValue);
      }
      
      csvContent += rowValues.join(',') + '\n';
    }
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentSheet.name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
  
  // If not logged in, return to auth page (you'd handle this in your routing)
  if (!user) {
    return <div className="flex items-center justify-center h-screen">Please sign in to access your sheets.</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center">
            <FileSpreadsheet className="w-6 h-6 text-green-600 mr-2" />
            <input 
              type="text" 
              value={currentSheet?.name || 'Untitled'} 
              onChange={(e) => {
                if (currentSheet) {
                  setCurrentSheet({...currentSheet, name: e.target.value});
                }
              }}
              onBlur={saveSheet}
              className="font-semibold focus:outline-none focus:border-b-2 focus:border-green-500 px-1"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <button onClick={saveSheet} className="flex items-center text-sm px-3 py-1 rounded hover:bg-gray-100">
              <Save className="w-4 h-4 mr-1" />
              Save
            </button>
            
            <button onClick={() => setIsSharing(true)} className="flex items-center text-sm px-3 py-1 rounded hover:bg-gray-100">
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </button>
            
            <button onClick={exportAsCSV} className="flex items-center text-sm px-3 py-1 rounded hover:bg-gray-100">
              <Download className="w-4 h-4 mr-1" />
              Export
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center text-sm px-2 py-1 rounded-full hover:bg-gray-100"
              >
                <User className="w-5 h-5" />
              </button>
              
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    {user.email}
                  </div>
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
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Documents Sidebar */}
        {showSidebar && (
          <div className="w-64 bg-white border-r overflow-y-auto">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-medium">My Documents</h2>
              <button 
                onClick={() => createNewSheet(user.id)}
                className="p-1 rounded-full hover:bg-gray-100"
                title="Create new sheet"
              >
                <Plus className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            <div className="py-2">
              {sheets.length > 0 ? (
                sheets.map(sheet => (
                  <button
                    key={sheet.id}
                    onClick={() => {
                      setCurrentSheet(sheet);
                      setCellValues(sheet.cells || {});
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center ${
                      currentSheet?.id === sheet.id
                        ? 'bg-green-50 text-green-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 mr-2 ${
                      currentSheet?.id === sheet.id
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`} />
                    <span className="truncate">{sheet.name || 'Untitled Sheet'}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {new Date(sheet.updated_at).toLocaleDateString()}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No documents yet. Create one to get started.
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-white border-b px-4 py-1 flex items-center">
            <div className="flex space-x-2">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-1 rounded hover:bg-gray-100"
                title={showSidebar ? "Hide sidebar" : "Show sidebar"}
              >
                <Menu className="w-4 h-4" />
              </button>
              
              <button
                onClick={deleteSheet}
                className="p-1 rounded hover:bg-red-100 text-red-600"
                title="Delete sheet"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="ml-4 flex-grow">
              <input
                ref={cellInputRef}
                type="text"
                value={getCellValue(selectedCell.row, selectedCell.col)}
                onChange={handleCellChange}
                onBlur={() => saveSheet()}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>
          
          {/* Spreadsheet grid */}
          <div className="flex-grow overflow-auto">
            <div className="inline-block min-w-full" ref={gridRef}>
              <table className="border-collapse">
                <thead>
                  <tr>
                    {/* Empty corner cell */}
                    <th className="w-10 h-8 bg-gray-100 border sticky top-0 left-0 z-20"></th>
                    
                    {/* Column headers */}
                    {columnLabels.map((col, index) => (
                      <th 
                        key={col} 
                        className="w-24 h-8 bg-gray-100 border text-center text-xs font-normal text-gray-600 sticky top-0 z-10"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 100 }).map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {/* Row headers */}
                      <td 
                        className="w-10 bg-gray-100 border text-center text-xs font-normal text-gray-600 sticky left-0 z-10"
                      >
                        {rowIndex + 1}
                      </td>
                      
                      {/* Data cells */}
                      {Array.from({ length: 26 }).map((_, colIndex) => (
                        <td 
                          key={colIndex}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          className={`w-24 h-6 border border-gray-200 px-1 text-sm ${
                            selectedCell.row === rowIndex && selectedCell.col === colIndex
                              ? 'bg-blue-50 outline outline-2 outline-blue-500 outline-offset-0 z-5'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {getCellValue(rowIndex, colIndex)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Share modal */}
      {isSharing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Share sheet</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder="user@example.com"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Access Type</label>
              <select
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="read">Can view</option>
                <option value="write">Can edit</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsSharing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleShareSheet}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpreadsheetApp;