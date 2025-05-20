// src/app/spreadsheet/[id]/page.tsx
"use client"

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Save, ArrowLeft, Download, User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SpreadsheetApp = ({ params }) => {
  // Get the sheet ID from the URL params
  const { id } = params;
  
  // State management
  const [user, setUser] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [cellValues, setCellValues] = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  
  const router = useRouter();
  const supabase = createClient();
  const gridRef = useRef(null);
  const cellInputRef = useRef(null);
  
  // Column header labels (A, B, C, etc.)
  const columnLabels = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  
  // Check user session and load sheet data on component mount
  useEffect(() => {
    const checkSessionAndLoadSheet = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login-signup');
        return;
      }
      
      setUser(session.user);
      
      // Fetch the specific sheet
      try {
        console.log('Fetching sheet with ID:', id);
        const { data, error } = await supabase
          .from('sheets')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) {
          console.error('Error fetching sheet:', error);
          if (error.code === 'PGRST116') {
            // Sheet not found or no permission
            router.push('/dashboard');
            return;
          }
          throw error;
        }
        
        console.log('Fetched sheet data:', data);
        setSheet(data);
        setCellValues(data.cells || {});
      } catch (error) {
        console.error('Error loading sheet:', error);
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSessionAndLoadSheet();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login-signup');
      }
    });
    
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [id, router]);
  
  // Save sheet to Supabase
  const saveSheet = async () => {
    if (!sheet) return;
    
    try {
      setSaveStatus('saving');
      console.log('Saving sheet with data:', {
        cells: cellValues,
        updated_at: new Date().toISOString()
      });
      
      const { error } = await supabase
        .from('sheets')
        .update({ 
          cells: cellValues,
          updated_at: new Date().toISOString()
        })
        .eq('id', sheet.id);
        
      if (error) {
        console.error('Error saving sheet:', error);
        throw error;
      }
      
      console.log('Sheet saved successfully');
      
      // Update local sheet data with new timestamp
      setSheet({
        ...sheet,
        updated_at: new Date().toISOString()
      });
      
      setSaveStatus('saved');
      
      // Reset save status after 2 seconds
      setTimeout(() => {
        setSaveStatus('');
      }, 2000);
    } catch (error) {
      console.error('Error saving sheet:', error);
      setSaveStatus('error');
      
      // Reset save status after 2 seconds
      setTimeout(() => {
        setSaveStatus('');
      }, 2000);
    }
  };
  
  // Handle sheet name change
  const handleNameChange = async (e) => {
    if (!sheet) return;
    
    try {
      setSaveStatus('saving');
      
      const { error } = await supabase
        .from('sheets')
        .update({ 
          name: e.target.value,
          updated_at: new Date().toISOString()
        })
        .eq('id', sheet.id);
        
      if (error) throw error;
      
      // Update local sheet data
      setSheet({
        ...sheet,
        name: e.target.value,
        updated_at: new Date().toISOString()
      });
      
      setSaveStatus('saved');
      
      // Reset save status after 2 seconds
      setTimeout(() => {
        setSaveStatus('');
      }, 2000);
    } catch (error) {
      console.error('Error updating sheet name:', error);
      setSaveStatus('error');
      
      // Reset save status after 2 seconds
      setTimeout(() => {
        setSaveStatus('');
      }, 2000);
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
  
  // Export sheet as CSV
  const exportAsCSV = () => {
    if (!sheet) return;
    
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
    link.setAttribute('download', `${sheet.name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login-signup');
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700">Sheet not found</h2>
          <p className="mt-2 text-gray-500">The sheet you're looking for doesn't exist or you don't have permission to access it.</p>
          <Link href="/dashboard" className="mt-4 inline-block px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center text-gray-700 hover:text-gray-900 mr-4">
              <ArrowLeft className="w-5 h-5 mr-1" />
              <span>Back</span>
            </Link>
            
            <input 
              type="text" 
              value={sheet.name} 
              onChange={(e) => {
                setSheet({...sheet, name: e.target.value});
              }}
              onBlur={handleNameChange}
              className="font-semibold focus:outline-none focus:border-b-2 focus:border-green-500 px-1"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <button onClick={saveSheet} className="flex items-center text-sm px-3 py-1 rounded hover:bg-gray-100">
                <Save className="w-4 h-4 mr-1" />
                Save
              </button>
              
              {saveStatus === 'saving' && (
                <span className="text-xs text-blue-500 ml-2">Saving...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-xs text-green-500 ml-2">Saved!</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-xs text-red-500 ml-2">Error saving!</span>
              )}
            </div>
            
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
                  <Link
                    href="/dashboard"
                    className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Dashboard
                  </Link>
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
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="bg-white border-b px-4 py-1 flex items-center">
            <div className="flex-grow">
              <input
                ref={cellInputRef}
                type="text"
                value={getCellValue(selectedCell.row, selectedCell.col)}
                onChange={handleCellChange}
                onBlur={() => saveSheet()}
                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                placeholder={`${columnLabels[selectedCell.col]}${selectedCell.row + 1}`}
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
    </div>
  );
};

export default SpreadsheetApp;