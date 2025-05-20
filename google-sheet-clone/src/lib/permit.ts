// lib/permit.ts
import { Permit } from "permitio";

// Initialize Permit with proper error handling
const initPermit = () => {
  try {
    return new Permit({
      pdp: "https://cloudpdp.api.permit.io",
      token: process.env.PERMIT_API_KEY,
    });
  } catch (error) {
    console.error("[Permit.io] Failed to initialize:", error);
    throw error;
  }
};

const permit = initPermit();

// Define our action types
export type Actions = "cananalyse" | "cancomment" | "cancreate" | "canview";

// Define our resource types
export type Resources =
  | "SocialsDashboard" // For the user's 


// Define our role types
export type UserRole =
  | "account-owner"
  | "analytics-viewer"
  | "content-manager"
  | "engagement-specialist";

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
// In your permit.ts file, update the check function:
const check = async (action: Actions, resource: Resources, userId: string) => {
  try {
    // Get the base URL - in development it's localhost, in production your domain
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";

    const response = await fetch(`${baseUrl}/api/permit/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        action,
        resource,
      }),
    });

    const data = await response.json();
    return data.permitted;
  } catch (error) {
    console.error("Permission check failed:", error);
    return false;
  }
};


export const checkSocialMediaPermissions = async (userId: string) => {
  const requestId = logPermitAction("Checking social media permissions", { userId });

  try {
    // Check permissions based on the defined actions
    const permissions = {
      canViewAnalytics: await check("cananalyse", "SocialsDashboard", userId),
      canCreatePosts: await check("cancreate", "SocialsDashboard", userId),
      // canEditPosts: await check("cancreate", "SocialsDashboard", userId),
      // canDeletePosts: await check("cancreate", "SocialsDashboard", userId),
      canRespondToComments: await check("cancomment", "SocialsDashboard", userId),
      // canAccessMessages: await check("cancomment", "SocialsDashboard", userId),
      // canModifySettings: await check("cancreate", "SocialsDashboard", userId),
      canView: await check("canview", "SocialsDashboard", userId),
    };

    logPermitAction(`Social media permissions result (${requestId})`, {
      userId,
      permissions,
    });

    return permissions;
  } catch (error) {
    console.error(
      `[Permit.io] (${requestId}) Social media permissions check failed:`,
      error
    );
    return {
      canViewAnalytics: false,
      canCreatePosts: false,
      canEditPosts: false,
      canDeletePosts: false,
      canRespondToComments: false,
      canAccessMessages: false,
      canModifySettings: false,
      canView: false,
    };
  }
};

// export const checkSocialaMediaPermissions = async (userId: string) => {
//   const requestId = logPermitAction("Checking health permissions", { userId });

//   try {
//     // Check permissions based on the defined actions
//     const [canViewFull, canViewLimited] = await Promise.all([
//       check("viewrecordsfull", "HealthRecords", userId),
//       check("viewrecordslimited", "HealthRecords", userId),
//     ]);

//     const permissions = {
//       canViewFull, // For partners and parents viewing full records
//       canViewLimited, // For doctors viewing limited records
//       canUpdate: await check("update", "HealthRecords", userId),
//     };

//     logPermitAction(`Health permissions result (${requestId})`, {
//       userId,
//       permissions,
//     });

//     return permissions;
//   } catch (error) {
//     console.error(
//       `[Permit.io] (${requestId}) Health permissions check failed:`,
//       error
//     );
//     return {
//       canViewFull: false,
//       canViewLimited: false,
//       canUpdate: false,
//     };
//   }
// };

// Enhanced user sync with role management
export const syncUserToPermit = async (
  user: { id: string; email: string },
  role: UserRole
) => {
  const requestId = logPermitAction("Starting user sync", {
    userId: user.id,
    email: user.email,
    role,
  });

  try {
    // Get base URL from environment or default to localhost
    const baseUrl = "http://localhost:3001";

    const response = await fetch(`${baseUrl}/api/permit/sync-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user, role }),
    });

    if (!response.ok) {
      console.log(response);
      throw new Error("Failed to sync user permissions");
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("[Permit.io] Failed to sync user:", error);
    return false;
  }
};

export default permit;
