// app/api/permit/sync-user/route.ts
import { NextResponse } from 'next/server';
import permit from '../../../../lib/permit';
import type { UserRole } from '../../../../lib/permit';

export async function POST(request: Request) {
  try {
    const { user, role } = await request.json();
    
    console.log('[Permit.io] Attempting to sync user:', {
      userId: user.id,
      email: user.email,
      role
    });

    // First sync the user
    const syncResult = await permit.api.syncUser({
      key: user.id,
      email: user.email,
      first_name: user.name,
      attributes: {
        provider: "supabase",
        last_sync: new Date().toISOString()
      }
    });

    if (!syncResult) {
      throw new Error('Failed to sync user');
    }

    // Only assign role if one was provided 

    if (role) {
      // Validate role
      const validRoles: UserRole[] = ['FreeUser', 'PremiumUser'];
      if (!validRoles.includes(role as UserRole)) {
        throw new Error('Invalid role provided');
      }

      // Assign role
      const roleResult = await permit.api.assignRole({
        role,
        tenant: "default",
        user: user.id
      });

      if (!roleResult) {
        throw new Error('Failed to assign role');
      }

      console.log('[Permit.io] Role assigned successfully:', {
        userId: user.id,
        role
      });
    }

    return NextResponse.json({ 
      success: true
    });

  } catch (error: any) {
    console.error('[Permit.io] Sync failed:', {
      error: error?.message
    });
    
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