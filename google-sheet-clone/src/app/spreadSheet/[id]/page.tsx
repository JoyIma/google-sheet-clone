// src/app/spreadsheet/[id]/page.tsx
"use client"

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Save, ArrowLeft, Download, User, LogOut, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Underline, Eye, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Share2 } from 'lucide-react';
import SimpleShareDialog from '../../../ components/SimpleShareDialog';

const SpreadsheetApp = ({ params }) => {
  // Unwrap the params Promise using React.use()
  const unwrappedParams = React.use(params);
  
  // Get the sheet ID from the unwrapped params
  const { id } = unwrappedParams;
  
  // State management
  const [user, setUser] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState({ row: 0, col: 0 });
  const [cellValues, setCellValues] = useState({});
  const [cellFormatting, setCellFormatting] = useState({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [columnWidths, setColumnWidths] = useState(Array(26).fill(160)); // Default width 160px
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    textAlign: 'left', // 'left', 'center', or 'right'
    textColor: '#000000',
    backgroundColor: '#ffffff'
  });
  
  // Permission states
  const [userPermissions, setUserPermissions] = useState({
    canRead: false,
    canUpdate: false,
    isReadOnly: true,
    role: 'Viewer'
  });
  
  const router = useRouter();
  const supabase = createClient();
  const gridRef = useRef(null);
  const cellInputRef = useRef(null);
  
  // Column header labels (A, B, C, etc.)
  const columnLabels = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  
  // Helper function to check sheet permissions
  const checkSheetPermission = async (userId, sheetId, action) => {
    try {
      const response = await fetch('/api/permit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action,
          resource: 'SheetDocument',
          spreadsheetId: sheetId
        })
      });
      
      const result = await response.json();
      return result.permitted;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  };
  
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
            router.push('/Dashboard');
            return;
          }
          throw error;
        }
        
        // Check permissions for this sheet
        const [canRead, canUpdate] = await Promise.all([
          checkSheetPermission(session.user.id, id, 'read'),
          checkSheetPermission(session.user.id, id, 'update')
        ]);
        
        console.log('Permissions:', { canRead, canUpdate });
        
        if (!canRead) {
          // User has no permission to access this sheet
          router.push('/Dashboard');
          return;
        }
        
        // Set permission state
        const permissions = {
          canRead,
          canUpdate,
          isReadOnly: !canUpdate,
          role: canUpdate ? (data.user_id === session.user.id ? 'Owner' : 'Editor') : 'Viewer'
        };
        
        setUserPermissions(permissions);
        
        console.log('Fetched sheet data:', data);
        setSheet(data);
        setCellValues(data.cells || {});
        setCellFormatting(data.formatting || {});
        
        // Load column widths if available
        if (data.column_widths && Array.isArray(data.column_widths)) {
          setColumnWidths(data.column_widths);
        }
      } catch (error) {
        console.error('Error loading sheet:', error);
        router.push('/Dashboard');
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
  
  // Add keyboard shortcuts for copy/paste (only if user can update)
  useEffect(() => {
    const handleKeyboardShortcuts = (e) => {
      // Check if Ctrl key (or Command key on Mac) is pressed
      const isCtrlPressed = e.ctrlKey || e.metaKey;
      
      if (isCtrlPressed) {
        switch (e.key.toLowerCase()) {
          case 'c': // Copy
            e.preventDefault();
            handleCopy();
            break;
          case 'v': // Paste (only if user can update)
            if (userPermissions.canUpdate) {
              e.preventDefault();
              handlePaste();
            }
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyboardShortcuts);
    
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcuts);
    };
  }, [selectedCell, selectionStart, selectionEnd, clipboard, cellValues, userPermissions.canUpdate]);
  
  // Add autosave functionality (only if user can update)
  useEffect(() => {
    if (!userPermissions.canUpdate) return;
    
    // Set up a debounced save
    const saveTimeout = setTimeout(() => {
      if (sheet && Object.keys(cellValues).length > 0) {
        saveSheet();
      }
    }, 2000); // 2 seconds after last change
    
    return () => clearTimeout(saveTimeout);
  }, [cellValues, cellFormatting, columnWidths, userPermissions.canUpdate]);
  
  // Column resize functionality (only if user can update)
  const startColumnResize = (columnIndex, e) => {
    if (!userPermissions.canUpdate) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = columnWidths[columnIndex];
    
    const handleMouseMove = (moveEvent) => {
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      const newColumnWidths = [...columnWidths];
      newColumnWidths[columnIndex] = newWidth;
      setColumnWidths(newColumnWidths);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Save sheet to Supabase (only if user can update)
  const saveSheet = async () => {
    if (!sheet || !userPermissions.canUpdate) return;
    
    try {
      setSaveStatus('saving');
      
      // Make sure data is valid before saving
      const safeValues = typeof cellValues === 'object' && cellValues !== null 
        ? JSON.parse(JSON.stringify(cellValues)) 
        : {};
      
      const safeFormatting = typeof cellFormatting === 'object' && cellFormatting !== null 
        ? JSON.parse(JSON.stringify(cellFormatting)) 
        : {};
      
      console.log('Saving sheet with data:', {
        cells: safeValues,
        formatting: safeFormatting,
        column_widths: columnWidths,
        updated_at: new Date().toISOString()
      });
      
      const { error } = await supabase
        .from('sheets')
        .update({ 
          cells: safeValues,
          formatting: safeFormatting,
          column_widths: columnWidths,
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
  
  // Handle sheet name change (only if user can update)
  const handleNameChange = async (e) => {
    if (!sheet || !userPermissions.canUpdate) return;
    
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
  
  // Formula evaluation
  const evaluateFormula = (formula, cellValues) => {
    // Simple formula evaluation for basic math expressions
    // Remove the '=' at the beginning
    const expression = formula.substring(1).trim();
    
    try {
      // Replace cell references (like A1, B2) with their values
      const cellReferenceRegex = /([A-Z])(\d+)/g;
      const expressionWithValues = expression.replace(cellReferenceRegex, (match, col, row) => {
        const colIndex = col.charCodeAt(0) - 65; // Convert A->0, B->1, etc.
        const rowIndex = parseInt(row) - 1;
        const cellId = `${rowIndex}-${colIndex}`;
        const value = cellValues[cellId] || '0';
        
        // Check if the value is a number
        return isNaN(Number(value)) ? '0' : value;
      });
      
      // Evaluate the expression
      // eslint-disable-next-line no-eval
      return eval(expressionWithValues);
    } catch (error) {
      console.error('Error evaluating formula:', error);
      return '#ERROR';
    }
  };
  
  // Handle cell click
  const handleCellClick = (rowIndex, colIndex) => {
    setSelectedCell({ row: rowIndex, col: colIndex });
    
    // Update active formats based on the selected cell
    const cellId = `${rowIndex}-${colIndex}`;
    const formats = cellFormatting[cellId] || {};
    
    setActiveFormats({
      bold: formats.bold || false,
      italic: formats.italic || false,
      underline: formats.underline || false,
      textAlign: formats.textAlign || 'left',
      textColor: formats.textColor || '#000000',
      backgroundColor: formats.backgroundColor || '#ffffff'
    });
    
    // Focus the input when a cell is selected (only if user can update)
    if (cellInputRef.current && userPermissions.canUpdate) {
      cellInputRef.current.focus();
    }
  };
  
  // Handle cell value change (only if user can update)
  const handleCellChange = (e) => {
    if (!userPermissions.canUpdate) return;
    
    const cellId = `${selectedCell.row}-${selectedCell.col}`;
    const newValues = { ...cellValues };
    newValues[cellId] = e.target.value;
    setCellValues(newValues);
  };
  
  // Get cell value (with formula evaluation)
  const getCellValue = (rowIndex, colIndex) => {
    const cellId = `${rowIndex}-${colIndex}`;
    const value = cellValues[cellId] || '';
    
    // If the cell value starts with '=', evaluate it as a formula
    if (typeof value === 'string' && value.startsWith('=')) {
      return evaluateFormula(value, cellValues);
    }
    
    return value;
  };
  
  // Get raw cell value (without formula evaluation)
  const getRawCellValue = (rowIndex, colIndex) => {
    const cellId = `${rowIndex}-${colIndex}`;
    return cellValues[cellId] || '';
  };
  
  // Get cell formatting
  const getCellFormatting = (rowIndex, colIndex) => {
    const cellId = `${rowIndex}-${colIndex}`;
    return cellFormatting[cellId] || {};
  };
  
  // Update cell formatting (only if user can update)
  const updateCellFormatting = (format) => {
    if (!selectedCell || !userPermissions.canUpdate) return;
    
    const cellId = `${selectedCell.row}-${selectedCell.col}`;
    const newFormatting = { ...cellFormatting };
    
    // If the format property is already set to the same value, toggle it off
    if (typeof format.bold === 'boolean' && format.bold === newFormatting[cellId]?.bold) {
      format.bold = !format.bold;
    }
    if (typeof format.italic === 'boolean' && format.italic === newFormatting[cellId]?.italic) {
      format.italic = !format.italic;
    }
    if (typeof format.underline === 'boolean' && format.underline === newFormatting[cellId]?.underline) {
      format.underline = !format.underline;
    }
    
    newFormatting[cellId] = {
      ...(newFormatting[cellId] || {}),
      ...format
    };
    
    setCellFormatting(newFormatting);
    
    // Also update active formats to reflect the current cell's formatting
    setActiveFormats({
      ...activeFormats,
      ...format
    });
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    const { key } = e;
    
    // Navigation keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(key)) {
      e.preventDefault();
      
      let newRow = selectedCell.row;
      let newCol = selectedCell.col;
      
      switch (key) {
        case 'ArrowUp':
          newRow = Math.max(0, newRow - 1);
          break;
        case 'ArrowDown':
        case 'Enter':
          newRow = Math.min(99, newRow + 1);
          break;
        case 'ArrowLeft':
          newCol = Math.max(0, newCol - 1);
          break;
        case 'ArrowRight':
        case 'Tab':
          newCol = Math.min(25, newCol + 1);
          break;
      }
      
      setSelectedCell({ row: newRow, col: newCol });
      
      // Update active formats for the newly selected cell
      const cellId = `${newRow}-${newCol}`;
      const formats = cellFormatting[cellId] || {};
      
      setActiveFormats({
        bold: formats.bold || false,
        italic: formats.italic || false,
        underline: formats.underline || false,
        textAlign: formats.textAlign || 'left',
        textColor: formats.textColor || '#000000',
        backgroundColor: formats.backgroundColor || '#ffffff'
      });
    }
  };
  
  // Cell selection for copy/paste and formulas
  const handleCellMouseDown = (rowIndex, colIndex, e) => {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    setSelectionStart({ row: rowIndex, col: colIndex });
    setSelectionEnd({ row: rowIndex, col: colIndex });
    setSelectedCell({ row: rowIndex, col: colIndex });
    
    // Update active formats for the selected cell
    const cellId = `${rowIndex}-${colIndex}`;
    const formats = cellFormatting[cellId] || {};
    
    setActiveFormats({
      bold: formats.bold || false,
      italic: formats.italic || false,
      underline: formats.underline || false,
      textAlign: formats.textAlign || 'left',
      textColor: formats.textColor || '#000000',
      backgroundColor: formats.backgroundColor || '#ffffff'
    });
  };
  
  const handleCellMouseOver = (rowIndex, colIndex) => {
    if (selectionStart) {
      setSelectionEnd({ row: rowIndex, col: colIndex });
    }
  };
  
  const handleCellMouseUp = () => {
    // The selection is now complete
    console.log('Selection from', selectionStart, 'to', selectionEnd);
  };
  
  // Check if a cell is in the current selection
  const isCellSelected = (rowIndex, colIndex) => {
    if (!selectionStart || !selectionEnd) return false;
    
    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);
    
    return (
      rowIndex >= minRow && 
      rowIndex <= maxRow && 
      colIndex >= minCol && 
      colIndex <= maxCol
    );
  };
  
  // Copy and paste functionality
  const handleCopy = () => {
    if (!selectionStart || !selectionEnd) return;
    
    const minRow = Math.min(selectionStart.row, selectionEnd.row);
    const maxRow = Math.max(selectionStart.row, selectionEnd.row);
    const minCol = Math.min(selectionStart.col, selectionEnd.col);
    const maxCol = Math.max(selectionStart.col, selectionEnd.col);
    
    const copiedData = [];
    const copiedFormatting = [];
    
    for (let r = minRow; r <= maxRow; r++) {
      const rowData = [];
      const rowFormatting = [];
      for (let c = minCol; c <= maxCol; c++) {
        const cellId = `${r}-${c}`;
        rowData.push(cellValues[cellId] || '');
        rowFormatting.push(cellFormatting[cellId] || {});
      }
      copiedData.push(rowData);
      copiedFormatting.push(rowFormatting);
    }
    
    setClipboard({
      data: copiedData,
      formatting: copiedFormatting,
      width: maxCol - minCol + 1,
      height: maxRow - minRow + 1
    });
    
    console.log('Copied to clipboard:', copiedData);
  };
  
  const handlePaste = () => {
    if (!clipboard || !selectedCell || !userPermissions.canUpdate) return;
    
    const { data, formatting, width, height } = clipboard;
    const { row: startRow, col: startCol } = selectedCell;
    
    const newCellValues = { ...cellValues };
    const newCellFormatting = { ...cellFormatting };
    
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const sourceValue = data[r][c];
        const sourceFormatting = formatting[r][c];
        const targetRow = startRow + r;
        const targetCol = startCol + c;
        
        if (targetRow < 100 && targetCol < 26) { // Stay within grid bounds
          const targetCellId = `${targetRow}-${targetCol}`;
          newCellValues[targetCellId] = sourceValue;
          if (Object.keys(sourceFormatting).length > 0) {
            newCellFormatting[targetCellId] = sourceFormatting;
          }
        }
      }
    }
    
    setCellValues(newCellValues);
    setCellFormatting(newCellFormatting);
    console.log('Pasted data at', selectedCell);
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
        const escapedValue = (cellValue?.toString() || '').includes(',') || (cellValue?.toString() || '').includes('"') 
          ? `"${(cellValue?.toString() || '').replace(/"/g, '""')}"` 
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
  
  // Format the current cell (only if user can update)
  const formatCurrentCell = (format) => {
    if (!selectedCell || !userPermissions.canUpdate) return;
    updateCellFormatting(format);
  };
  
  // Formatting toolbar component
  const FormattingToolbar = () => {
    return (
      <div className="bg-white border-b px-4 py-1 flex items-center space-x-2">
        {/* Permission indicator */}
        <div className="flex items-center mr-4 px-2 py-1 rounded-md bg-gray-100">
          {userPermissions.isReadOnly ? (
            <>
              <Eye className="w-4 h-4 mr-1 text-gray-600" />
              <span className="text-xs text-gray-600">View Only ({userPermissions.role})</span>
            </>
          ) : (
            <>
              <span className="text-xs text-green-600">Edit Mode ({userPermissions.role})</span>
            </>
          )}
        </div>

        {/* Formatting buttons - only show if user can update */}
        {userPermissions.canUpdate && (
          <>
            <button
              onClick={() => formatCurrentCell({ bold: !activeFormats.bold })}
              className={`p-1 rounded ${activeFormats.bold ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => formatCurrentCell({ italic: !activeFormats.italic })}
              className={`p-1 rounded ${activeFormats.italic ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => formatCurrentCell({ underline: !activeFormats.underline })}
              className={`p-1 rounded ${activeFormats.underline ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </button>
            
            <div className="h-4 border-l border-gray-300 mx-1"></div>
            
            <button
              onClick={() => formatCurrentCell({ textAlign: 'left' })}
              className={`p-1 rounded ${activeFormats.textAlign === 'left' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Align Left"
            >
              <AlignLeft className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => formatCurrentCell({ textAlign: 'center' })}
              className={`p-1 rounded ${activeFormats.textAlign === 'center' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Align Center"
            >
              <AlignCenter className="h-4 w-4" />
            </button>
            
            <button
              onClick={() => formatCurrentCell({ textAlign: 'right' })}
              className={`p-1 rounded ${activeFormats.textAlign === 'right' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
              title="Align Right"
            >
              <AlignRight className="h-4 w-4" />
            </button>
            
            <div className="h-4 border-l border-gray-300 mx-1"></div>
            
            <div className="flex items-center">
              <label htmlFor="text-color" className="text-xs text-gray-500 mr-1">Color:</label>
              <input
                type="color"
                id="text-color"
                value={activeFormats.textColor}
                onChange={(e) => formatCurrentCell({ textColor: e.target.value })}
                className="w-5 h-5 border border-gray-300 cursor-pointer"
              />
            </div>
            
            <div className="flex items-center">
              <label htmlFor="bg-color" className="text-xs text-gray-500 mr-1">Fill:</label>
              <input
                type="color"
                id="bg-color"
                value={activeFormats.backgroundColor}
                onChange={(e) => formatCurrentCell({ backgroundColor: e.target.value })}
                className="w-5 h-5 border border-gray-300 cursor-pointer"
              />
            </div>
          </>
        )}
        
        {/* Share button - only show for owners */}
        {userPermissions.role === 'Owner' && (
          <button 
            onClick={() => setIsShareDialogOpen(true)} 
            className="flex items-center text-sm px-3 py-1 rounded hover:bg-gray-100 ml-4"
          >
            <Share2 className="w-4 h-4 mr-1" />
            Share
          </button>
        )}
      </div>
    );
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
          <Link href="/Dashboard" className="mt-4 inline-block px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700">
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
            <Link href="/Dashboard" className="flex items-center text-gray-700 hover:text-gray-900 mr-4">
              <ArrowLeft className="w-5 h-5 mr-1" />
              <span>Back</span>
            </Link>
            
            {userPermissions.canUpdate ? (
              <input 
                type="text" 
                value={sheet.name} 
                onChange={(e) => {
                  setSheet({...sheet, name: e.target.value});
                }}
                onBlur={handleNameChange}
                className="font-semibold focus:outline-none focus:border-b-2 focus:border-green-500 px-1"
              />
            ) : (
              <span className="font-semibold px-1 flex items-center">
                {sheet.name}
                <Lock className="w-4 h-4 ml-2 text-gray-400" />
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Save button - only show if user can update */}
            {userPermissions.canUpdate && (
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
            )}
            
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
                    <div className="text-xs text-gray-500">{userPermissions.role}</div>
                  </div>
                  <Link
                    href="/Dashboard"
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
          {/* Formula bar */}
          <div className="bg-white border-b px-4 py-1 flex items-center">
            <div className="w-20 mr-2 text-sm text-gray-500">
              {selectedCell ? `${columnLabels[selectedCell.col]}${selectedCell.row + 1}` : ''}
            </div>
            <div className="flex-grow">
              <input
                ref={cellInputRef}
                type="text"
                value={selectedCell ? getRawCellValue(selectedCell.row, selectedCell.col) : ''}
                onChange={handleCellChange}
                onKeyDown={handleKeyDown}
                onBlur={() => userPermissions.canUpdate && saveSheet()}
                className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-green-500 ${
                  userPermissions.isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                }`}
                placeholder={userPermissions.isReadOnly ? "Read-only mode" : "Enter value or formula (start with =)"}
                disabled={userPermissions.isReadOnly}
              />
            </div>
          </div>
          
          {/* Formatting toolbar */}
          <FormattingToolbar />
          
          {/* Spreadsheet grid */}
          <div className="flex-grow overflow-auto">
            <div className="inline-block" ref={gridRef}>
              <table className="border-collapse" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    {/* Empty corner cell */}
                    <th className="w-10 h-8 bg-gray-100 border sticky top-0 left-0 z-20"></th>
                    
                    {/* Column headers with resize handles */}
                    {columnLabels.map((col, index) => (
                      <th 
                        key={col} 
                        className="h-8 bg-gray-100 border text-center text-xs font-normal text-gray-600 sticky top-0 z-10 relative"
                        style={{ width: `${columnWidths[index]}px` }}
                      >
                        {col}
                        {/* Only show resize handle if user can update */}
                        {userPermissions.canUpdate && (
                          <div 
                            className="absolute top-0 right-0 h-full cursor-col-resize"
                            onMouseDown={(e) => startColumnResize(index, e)}
                            style={{
                              width: '4px',
                              right: '0',
                              top: '0',
                              height: '100%',
                              position: 'absolute',
                              cursor: 'col-resize',
                              zIndex: 11
                            }}
                          />
                        )}
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
                      {Array.from({ length: 26 }).map((_, colIndex) => {
                        const formatting = getCellFormatting(rowIndex, colIndex);
                        return (
                          <td 
                            key={colIndex}
                            onClick={() => handleCellClick(rowIndex, colIndex)}
                            onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                            onMouseOver={() => handleCellMouseOver(rowIndex, colIndex)}
                            onMouseUp={handleCellMouseUp}
                            className={`h-6 border border-gray-200 px-1 text-sm ${
                              selectedCell.row === rowIndex && selectedCell.col === colIndex
                                ? 'bg-blue-50 outline outline-2 outline-blue-500 outline-offset-0 z-5'
                                : isCellSelected(rowIndex, colIndex)
                                  ? 'bg-blue-50 outline outline-1 outline-blue-300 outline-offset-0'
                                  : userPermissions.isReadOnly 
                                    ? 'hover:bg-gray-50 cursor-default'
                                    : 'hover:bg-gray-50'
                            } ${userPermissions.isReadOnly ? 'select-none' : ''}`}
                            style={{
                              width: `${columnWidths[colIndex]}px`,
                              fontWeight: formatting.bold ? 'bold' : 'normal',
                              fontStyle: formatting.italic ? 'italic' : 'normal',
                              textDecoration: formatting.underline ? 'underline' : 'none',
                              textAlign: formatting.textAlign || 'left',
                              color: formatting.textColor || '#000000',
                              backgroundColor: userPermissions.isReadOnly 
                                ? (formatting.backgroundColor === '#ffffff' ? '#f9f9f9' : formatting.backgroundColor)
                                : (formatting.backgroundColor || '#ffffff'),
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {getCellValue(rowIndex, colIndex)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Only show share dialog for owners */}
      {userPermissions.role === 'Owner' && (
        <SimpleShareDialog 
          isOpen={isShareDialogOpen}
          onClose={() => setIsShareDialogOpen(false)}
          sheet={sheet}
        />
      )}
    </div>
  );
};

export default SpreadsheetApp;