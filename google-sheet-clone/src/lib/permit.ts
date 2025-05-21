// lib/permit.ts
import { Permit } from "permitio";

// Initialize Permit with proper error handling
const initPermit = () => {
  try {
    return new Permit({
      pdp: "http://localhost:7766/",
      token: "permit_key_rrnA8tGmJ0pztw5Qxr0KngOI3nSoHStJFCvyjVnZBbtw7UgpLTiDDDtkCu0Qz5yK1uYsskBcbJqESHeIsfR0bM",
    });
  } catch (error) {
    console.error("[Permit.io] Failed to initialize:", error);
    throw error;
  }
};

const permit = initPermit();

// Define our action types for spreadsheets
export type Actions = "create" | "read" | "update";

// Define our resource types
export type Resources = "SheetDocument";

// Define our role types for spreadsheets
export type UserRole = "owner" | "editor" | "viewer";

// Enhanced logging with timestamps
const logPermitAction = (action: string, details: any) => {
  const requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  console.log(
    `[Permit.io] ${timestamp} (${requestId}) ${action}:`,
    JSON.stringify(details, null, 2)
  );
  return requestId;
};

// Verify user exists in Permit.io
export const verifyUserExists = async (userId: string): Promise<boolean> => {
  try {
    const user = await permit.api.getUser(userId);
    return !!user;
  } catch (error) {
    return false;
  }
};

// Permission check function
export const check = async (userId: string, action: Actions, resource: string) => {
  try {
    logPermitAction("Checking permission", { userId, action, resource });
    return await permit.check(userId, action, resource);
  } catch (error) {
    console.error("Permission check failed:", error);
    return false;
  }
};

// Create a spreadsheet resource in Permit.io
export const createSpreadsheetResource = async (spreadsheetId: string) => {
  try {
    logPermitAction("Creating spreadsheet resource", { spreadsheetId });
    
    const resourceInstance = await permit.api.resourceInstances.create({
      key: spreadsheetId,
      tenant: "default",
      resource: "SheetDocument",
    });
    
    console.log("[Permit.io] Created spreadsheet resource:", resourceInstance);
    return { success: true, data: resourceInstance };
  } catch (error) {
    console.error("[Permit.io] Failed to create resource:", error);
    return { success: false, error };
  }
};

// Assign a role to a user for a specific spreadsheet
export const assignSpreadsheetRole = async (
  userId: string, 
  spreadsheetId: string, 
  role: UserRole
) => {
  try {
    logPermitAction("Assigning spreadsheet role", { userId, spreadsheetId, role });
    
    const roleAssignment = await permit.api.roleAssignments.assign({
      user: userId,
      role: `SheetDocument#${role.toLowerCase()}`,
      resource_instance: spreadsheetId,
      tenant: "default",
    });
    
    console.log("[Permit.io] Role assigned successfully:", roleAssignment);
    return { success: true, data: roleAssignment };
  } catch (error) {
    console.error("[Permit.io] Failed to assign role:", error);
    return { success: false, error };
  }
};

// Sync a user with Permit.io
export const syncUserWithPermit = async (user: { id: string; email: string; name?: string }) => {
  try {
    logPermitAction("Syncing user", user);
    
    const syncedUser = await permit.api.syncUser({
      key: user.id,
      email: user.email,
      first_name: user.name || user.email.split('@')[0],
      attributes: {
        provider: "supabase",
        last_sync: new Date().toISOString()
      }
    });
    
    console.log("[Permit.io] User synced successfully:", syncedUser);
    return { success: true, data: syncedUser };
  } catch (error) {
    console.error("[Permit.io] Failed to sync user:", error);
    return { success: false, error };
  }
};

export default permit;