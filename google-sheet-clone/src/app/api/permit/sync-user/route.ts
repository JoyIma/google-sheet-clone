// app/api/permit/sync-user/route.ts
import { NextResponse } from 'next/server';
import { syncUserWithPermit } from '../../../../lib/permit';

export async function POST(request: Request) {
  try {
    const { user } = await request.json();
    
    console.log('[Permit.io] Attempting to sync user:', {
      userId: user.id,
      email: user.email,
      name: user.name
    });

    // Sync the user (no role assignment - just user sync)
    const syncResult = await syncUserWithPermit(user);

    if (!syncResult.success) {
      throw new Error(syncResult.error || 'Failed to sync user');
    }

    return NextResponse.json({ 
      success: true,
      synced: true
    });

  } catch (error: any) {
    console.error('[Permit.io] Sync failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to sync user',
        details: error?.message 
      },
      { status: 500 }
    );
  }
}