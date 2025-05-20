// app/api/permit/check/route.ts
import { NextResponse } from 'next/server';
import permit from '../../../../lib/permit';
import { unstable_cache } from 'next/cache';

// Cache the permission check
const checkPermissionCached = unstable_cache(
  async (userId: string, action: string, resource: string) => {
    try {
      const userExists = await permit.api.getUser(userId);
      if (!userExists) {
        return false;
      }
      return await permit.check(userId, action, resource);
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  },
  ['permit-check'],
  { revalidate: 60 * 1 } // Cache for 10 minutes
);

export async function POST(request: Request) {
  try {
    const { userId, action, resource } = await request.json();
    const permitted = await checkPermissionCached(userId, action, resource);
    return NextResponse.json({ permitted });
  } catch (error) {
    console.error('Permission check failed:', error);
    return NextResponse.json({ permitted: false });
  }
}