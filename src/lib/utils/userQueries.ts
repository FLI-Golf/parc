import pb from '$lib/pocketbase';
import type { RecordModel } from 'pocketbase';

export interface User extends RecordModel {
  name: string;
  email: string;
  role: 'owner' | 'manager' | 'server' | 'host' | 'bartender' | 'busser' | 'chef' | 'kitchen_prep' | 'dishwasher';
  avatar: string;
  verified: boolean;
  emailVisibility: boolean;
}

// Get all users
export async function getAllUsers(): Promise<User[]> {
  try {
    const records = await pb.collection('users').getFullList<User>();
    return records;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
}

// Get users by role
export async function getUsersByRole(role: 'owner' | 'manager' | 'server' | 'host' | 'bartender' | 'busser' | 'chef' | 'kitchen_prep' | 'dishwasher'): Promise<User[]> {
  try {
    const records = await pb.collection('users').getFullList<User>({
      filter: `role = "${role}"`
    });
    return records;
  } catch (error) {
    console.error(`Error fetching ${role}s:`, error);
    throw error;
  }
}

// Get managers
export async function getManagers(): Promise<User[]> {
  return getUsersByRole('manager');
}

// Get servers
export async function getServers(): Promise<User[]> {
  return getUsersByRole('server');
}

// Get user by ID
export async function getUserById(id: string): Promise<User> {
  try {
    const record = await pb.collection('users').getOne<User>(id);
    return record;
  } catch (error) {
    console.error(`Error fetching user with ID ${id}:`, error);
    throw error;
  }
}

// Search users by name
export async function searchUsersByName(name: string): Promise<User[]> {
  try {
    const records = await pb.collection('users').getFullList<User>({
      filter: `name ?~ "${name}"`,
      sort: '-updated'
    });
    return records;
  } catch (error) {
    console.error(`Error searching users by name "${name}":`, error);
    throw error;
  }
}

// Get verified users
export async function getVerifiedUsers(): Promise<User[]> {
  try {
    const records = await pb.collection('users').getFullList<User>({
      filter: 'verified = true',
      sort: '-updated'
    });
    return records;
  } catch (error) {
    console.error('Error fetching verified users:', error);
    throw error;
  }
}

// Get users with avatars
export async function getUsersWithAvatars(): Promise<User[]> {
  try {
    const records = await pb.collection('users').getFullList<User>({
      filter: 'avatar != ""',
      sort: '-updated'
    });
    return records;
  } catch (error) {
    console.error('Error fetching users with avatars:', error);
    throw error;
  }
}

// Get users created after a specific date
export async function getUsersCreatedAfter(date: string): Promise<User[]> {
  try {
    const records = await pb.collection('users').getFullList<User>({
      filter: `created > "${date}"`,
      sort: '-created'
    });
    return records;
  } catch (error) {
    console.error(`Error fetching users created after ${date}:`, error);
    throw error;
  }
}

// Get users for current authenticated user based on role
export async function getUsersForCurrentUser(): Promise<User[]> {
  if (!pb.authStore.isValid) {
    throw new Error('User not authenticated');
  }

  const currentUser = pb.authStore.model;
  
  if (!currentUser) {
    throw new Error('Current user not found');
  }

  // If user is a manager, they can see all users
  if (currentUser.role === 'manager' || currentUser.role === 'owner') {
    return getAllUsers();
  }

  // If user is a server, they can only see themselves
  return [currentUser as User];
}

// Get team members (users with same role as current user)
export async function getTeamMembers(): Promise<User[]> {
  if (!pb.authStore.isValid) {
    throw new Error('User not authenticated');
  }

  const currentUser = pb.authStore.model;
  
  if (!currentUser) {
    throw new Error('Current user not found');
  }
  
  const userRole = currentUser.role;

  try {
    const records = await pb.collection('users').getFullList<User>({
      filter: `role = "${userRole}"`,
      sort: '-updated'
    });
    return records;
  } catch (error) {
    console.error(`Error fetching team members with role ${userRole}:`, error);
    throw error;
  }
}

// Advanced search with multiple filters
export async function advancedUserSearch(filters: {
  role?: 'owner' | 'manager' | 'server' | 'host' | 'bartender' | 'busser' | 'chef' | 'kitchen_prep' | 'dishwasher';
  name?: string;
  verified?: boolean;
  hasAvatar?: boolean;
  createdAfter?: string;
}): Promise<User[]> {
  const filterConditions: string[] = [];

  if (filters.role) {
    filterConditions.push(`role = "${filters.role}"`);
  }

  if (filters.name) {
    filterConditions.push(`name ?~ "${filters.name}"`);
  }

  if (filters.verified !== undefined) {
    filterConditions.push(`verified = ${filters.verified}`);
  }

  if (filters.hasAvatar !== undefined) {
    if (filters.hasAvatar) {
      filterConditions.push('avatar != ""');
    } else {
      filterConditions.push('avatar = ""');
    }
  }

  if (filters.createdAfter) {
    filterConditions.push(`created > "${filters.createdAfter}"`);
  }

  const filterString = filterConditions.join(' && ');

  try {
    const records = await pb.collection('users').getFullList<User>({
      filter: filterString,
      sort: '-updated'
    });
    return records;
  } catch (error) {
    console.error('Error in advanced user search:', error);
    throw error;
  }
}