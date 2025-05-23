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
// Define our role types for spreadsheets
export type UserRole = "Owner" | "Editor" | "Viewer";

// Define our action types
export type SheetAction = "create" | "read" | "update";



// Sync a user with Permit.io (used on signup)
export const syncUserWithPermit = async (user: { id: string; email: string; name?: string }) => {
 try {
   console.log("[Permit.io] Syncing user:", user);
   
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
// Create a spreadsheet resource in Permit.io
export const createSpreadsheetResource = async (spreadsheetId: string) => {
 try {
   console.log("[Permit.io] Creating spreadsheet resource:", spreadsheetId);
   
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
   console.log("[Permit.io] Assigning spreadsheet role:", { userId, spreadsheetId, role });
   
   const roleAssignment = await permit.api.roleAssignments.assign({
     user: userId,
     role: `${role}`, // Keep original capitalization
     tenant: "default",
     resource_instance: `SheetDocument:${spreadsheetId}`,
   });
   
   console.log("[Permit.io] Role assigned successfully:", roleAssignment);
   return { success: true, data: roleAssignment };
 } catch (error) {
   console.error("[Permit.io] Failed to assign role:", error);
   return { success: false, error };
 }
};
export default permit;