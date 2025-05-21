// app/api/permit/resource/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createSpreadsheetResource, assignSpreadsheetRole } from '../../../../lib/permit';

export async function POST(request: Request) {
  try {
    const { action, spreadsheetId, userId, role } = await request.json();
    
    // Get the current user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    
    switch (action) {
      case 'create-resource':
        if (!spreadsheetId) {
          return NextResponse.json({ success: false, error: 'Missing spreadsheetId' }, { status: 400 });
        }
        
        const resourceResult = await createSpreadsheetResource(spreadsheetId);
        return NextResponse.json(resourceResult);
      
      case 'assign-role':
        if (!userId || !spreadsheetId || !role) {
          return NextResponse.json({ 
            success: false, 
            error: 'Missing required parameters (userId, spreadsheetId, role)' 
          }, { status: 400 });
        }
        
        const roleResult = await assignSpreadsheetRole(userId, spreadsheetId, role);
        return NextResponse.json(roleResult);
      
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Permit resource API error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Server error' 
    }, { status: 500 });
  }
}