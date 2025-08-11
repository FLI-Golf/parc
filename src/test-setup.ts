import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock PocketBase
const mockPocketBase = {
  authStore: {
    isValid: true,
    model: {
      id: 'test-user-id',
      email: 'test@parcbistro.com',
      role: 'Server'
    }
  },
  collection: vi.fn(() => ({
    getList: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    authWithPassword: vi.fn()
  }))
};

vi.mock('pocketbase', () => {
  return {
    default: vi.fn(() => mockPocketBase)
  };
});

// Setup global test utilities
global.testUser = {
  server: {
    id: 'y75ww2u9169kinb',
    email: 'marie.rousseau@parcbistro.com',
    role: 'Server',
    name: 'Marie Rousseau'
  },
  manager: {
    id: 'f191z14z2679pzf',
    email: 'pierre.dubois@parcbistro.com', 
    role: 'Manager',
    name: 'Pierre Dubois'
  },
  chef: {
    id: 'ogwwm9dsfye6244',
    email: 'antoine.moreau@parcbistro.com',
    role: 'Chef',
    name: 'Antoine Moreau'
  },
  bartender: {
    id: 'p778xzv51v0935b',
    email: 'jacques.bernard@parcbistro.com',
    role: 'Bartender', 
    name: 'Jacques Bernard'
  },
  host: {
    id: '1rpz327lesd87j6',
    email: 'celine.petit@parcbistro.com',
    role: 'Host',
    name: 'Céline Petit'
  }
};
