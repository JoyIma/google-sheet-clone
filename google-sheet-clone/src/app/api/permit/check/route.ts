// app/api/permit/check/route.ts - FIXED VERSION
import { NextResponse } from 'next/server';
import permit from '../../../../lib/permit';
import { unstable_cache } from 'next/cache';

// Cache the permission check
const checkPermissionCached = unstable_cache(
  async (userId: string, action: string, resource: string, spreadsheetId?: string) => {
    try {
      console.log('[Permit Check] Checking:', { userId, action, resource, spreadsheetId });
      
      const userExists = await permit.api.getUser(userId);
      if (!userExists) {
        console.log('[Permit Check] User not found:', userId);
        return false;
      }

      // If checking sheet-specific permissions
      if (spreadsheetId && resource === 'SheetDocument') {
        console.log('[Permit Check] Checking sheet-specific permission');
        const result = await permit.check(
          userId,
          action,
          {
            type: "SheetDocument",
            key: spreadsheetId,
            tenant: "default"
          }
        );
        console.log('[Permit Check] Sheet permission result:', result);
        return result;
      }

      // General resource permission
      console.log('[Permit Check] Checking general permission');
      const result = await permit.check(userId, action, resource);
      console.log('[Permit Check] General permission result:', result);
      return result;
      
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  },
  ['permit-check'],
  { revalidate: 60 * 1 } // Cache for 1 minute
);

export async function POST(request: Request) {
  try {
    const { userId, action, resource, spreadsheetId } = await request.json(); // ← Now includes spreadsheetId
    
    console.log('[Permit API] Request:', { userId, action, resource, spreadsheetId });
    
    const permitted = await checkPermissionCached(userId, action, resource, spreadsheetId);
    
    console.log('[Permit API] Final result:', permitted);
    
    return NextResponse.json({ permitted });
  } catch (error) {
    console.error('Permission check failed:', error);
    return NextResponse.json({ permitted: false });
  }
}