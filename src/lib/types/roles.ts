// Restaurant role definitions
export const RESTAURANT_ROLES = {
  // Management Roles
  owner: 'Owner',
  manager: 'Manager',
  
  // Service Roles
  server: 'Server',
  host: 'Host',
  bartender: 'Bartender',
  busser: 'Busser',
  
  // Kitchen Roles
  chef: 'Chef',
  kitchen_prep: 'Kitchen Prep',
  dishwasher: 'Dishwasher'
} as const;

export type RestaurantRole = keyof typeof RESTAURANT_ROLES;
export type RestaurantRoleDisplay = typeof RESTAURANT_ROLES[RestaurantRole];

// Permission levels for dashboard access
export const PERMISSION_LEVELS = {
  admin: ['owner', 'manager'],           // Full system access
  staff: ['server', 'host', 'bartender', 'busser'], // Basic staff access
  kitchen: ['chef', 'kitchen_prep', 'dishwasher']   // Kitchen-specific access
} as const;

export type PermissionLevel = keyof typeof PERMISSION_LEVELS;

// Helper functions
export function getRoleDisplay(role: RestaurantRole): RestaurantRoleDisplay {
  return RESTAURANT_ROLES[role];
}

export function getPermissionLevel(role: RestaurantRole): PermissionLevel {
  if (PERMISSION_LEVELS.admin.includes(role)) return 'admin';
  if (PERMISSION_LEVELS.staff.includes(role)) return 'staff';
  if (PERMISSION_LEVELS.kitchen.includes(role)) return 'kitchen';
  return 'staff'; // default
}

export function hasAdminAccess(role: RestaurantRole): boolean {
  return PERMISSION_LEVELS.admin.includes(role);
}

export function hasStaffAccess(role: RestaurantRole): boolean {
  return PERMISSION_LEVELS.staff.includes(role) || hasAdminAccess(role);
}

export function hasKitchenAccess(role: RestaurantRole): boolean {
  return PERMISSION_LEVELS.kitchen.includes(role) || hasAdminAccess(role);
}

// Get all roles as array for dropdowns/selects
export const ALL_ROLES = Object.keys(RESTAURANT_ROLES) as RestaurantRole[];
export const ALL_ROLE_DISPLAYS = Object.values(RESTAURANT_ROLES);
