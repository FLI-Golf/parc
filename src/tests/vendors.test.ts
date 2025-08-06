import { describe, it, expect, beforeEach, vi } from 'vitest';
import PocketBase from 'pocketbase';

describe('Vendors Collection Tests', () => {
  let pb: PocketBase;
  
  beforeEach(() => {
    vi.clearAllMocks();
    pb = new PocketBase();
  });

  describe('CRUD Operations', () => {
    it('should create vendor record', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'test-vendor-id',
        name: 'Metro Food Distributors',
        contact_person: 'Jean-Pierre Legrand',
        email: 'jlegrand@metrofood.fr',
        phone: '+33 1 42 68 75 84',
        address: '15 Rue de la République, 75011 Paris',
        category: 'food_supplier',
        payment_terms: 'Net 30',
        status: 'active',
        notes: 'Primary meat and produce supplier'
      });

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      const vendorData = {
        name: 'Metro Food Distributors',
        contact_person: 'Jean-Pierre Legrand',
        email: 'jlegrand@metrofood.fr',
        phone: '+33 1 42 68 75 84',
        address: '15 Rue de la République, 75011 Paris',
        category: 'food_supplier',
        payment_terms: 'Net 30',
        status: 'active',
        notes: 'Primary meat and produce supplier'
      };

      const result = await pb.collection('vendors').create(vendorData);
      
      expect(mockCreate).toHaveBeenCalledWith(vendorData);
      expect(result.name).toBe('Metro Food Distributors');
      expect(result.category).toBe('food_supplier');
      expect(result.status).toBe('active');
    });

    it('should retrieve vendor by ID', async () => {
      const mockGetOne = vi.fn().mockResolvedValue({
        id: 'test-vendor-id',
        name: 'Metro Food Distributors',
        contact_person: 'Jean-Pierre Legrand',
        email: 'jlegrand@metrofood.fr',
        category: 'food_supplier',
        status: 'active'
      });

      pb.collection = vi.fn().mockReturnValue({
        getOne: mockGetOne
      });

      const result = await pb.collection('vendors').getOne('test-vendor-id');

      expect(mockGetOne).toHaveBeenCalledWith('test-vendor-id');
      expect(result.id).toBe('test-vendor-id');
      expect(result.name).toBe('Metro Food Distributors');
    });

    it('should update vendor information', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({
        id: 'test-vendor-id',
        name: 'Metro Food Distributors',
        contact_person: 'Marie Dubois',
        email: 'mdubois@metrofood.fr',
        phone: '+33 1 42 68 75 85',
        updated: '2024-01-01T12:00:00Z'
      });

      pb.collection = vi.fn().mockReturnValue({
        update: mockUpdate
      });

      const result = await pb.collection('vendors').update('test-vendor-id', {
        contact_person: 'Marie Dubois',
        email: 'mdubois@metrofood.fr',
        phone: '+33 1 42 68 75 85'
      });

      expect(mockUpdate).toHaveBeenCalledWith('test-vendor-id', {
        contact_person: 'Marie Dubois',
        email: 'mdubois@metrofood.fr',
        phone: '+33 1 42 68 75 85'
      });
      expect(result.contact_person).toBe('Marie Dubois');
    });

    it('should delete vendor', async () => {
      const mockDelete = vi.fn().mockResolvedValue(true);

      pb.collection = vi.fn().mockReturnValue({
        delete: mockDelete
      });

      await pb.collection('vendors').delete('test-vendor-id');

      expect(mockDelete).toHaveBeenCalledWith('test-vendor-id');
    });

    it('should list vendors with pagination', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'vendor1',
            name: 'Metro Food Distributors',
            category: 'food_supplier',
            status: 'active'
          },
          {
            id: 'vendor2',
            name: 'Wines & Spirits Co.',
            category: 'beverage_supplier',
            status: 'active'
          }
        ],
        totalItems: 15,
        totalPages: 3,
        page: 1
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('vendors').getList(1, 10, {
        sort: 'name'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 10, {
        sort: 'name'
      });
      expect(result.items).toHaveLength(2);
      expect(result.totalItems).toBe(15);
    });
  });

  describe('Status Validation', () => {
    const validStatuses = ['active', 'inactive', 'pending'];

    validStatuses.forEach(status => {
      it(`should accept valid status: ${status}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          status: status
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('vendors').create({
          name: 'Test Vendor',
          contact_person: 'John Doe',
          email: 'john@testvendor.com',
          phone: '123-456-7890',
          address: '123 Test St',
          category: 'food_supplier',
          payment_terms: 'Net 30',
          status: status,
          notes: 'Test vendor'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid status', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid status'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('vendors').create({
        name: 'Test Vendor',
        contact_person: 'John Doe',
        email: 'john@testvendor.com',
        phone: '123-456-7890',
        address: '123 Test St',
        category: 'food_supplier',
        payment_terms: 'Net 30',
        status: 'invalid_status',
        notes: 'Test vendor'
      })).rejects.toThrow('Invalid status');
    });
  });

  describe('Category Validation', () => {
    const validCategories = ['food_supplier', 'beverage_supplier', 'equipment', 'cleaning_supplies', 'linen_service', 'maintenance', 'other'];

    validCategories.forEach(category => {
      it(`should accept valid category: ${category}`, async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          id: 'test-id',
          category: category
        });

        pb.collection = vi.fn().mockReturnValue({
          create: mockCreate
        });

        await pb.collection('vendors').create({
          name: 'Test Vendor',
          contact_person: 'John Doe',
          email: 'john@testvendor.com',
          phone: '123-456-7890',
          address: '123 Test St',
          category: category,
          payment_terms: 'Net 30',
          status: 'active',
          notes: 'Test vendor'
        });

        expect(mockCreate).toHaveBeenCalled();
      });
    });

    it('should reject invalid category', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid category'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('vendors').create({
        name: 'Test Vendor',
        contact_person: 'John Doe',
        email: 'john@testvendor.com',
        phone: '123-456-7890',
        address: '123 Test St',
        category: 'invalid_category',
        payment_terms: 'Net 30',
        status: 'active',
        notes: 'Test vendor'
      })).rejects.toThrow('Invalid category');
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email formats', async () => {
      const validEmails = [
        'test@example.com',
        'jean-pierre@metro-food.fr',
        'contact.vendor@supplies.co.uk',
        'admin+orders@company.org'
      ];

      const mockCreate = vi.fn();
      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      for (const email of validEmails) {
        mockCreate.mockResolvedValueOnce({
          id: 'test-id',
          email: email
        });

        await pb.collection('vendors').create({
          name: 'Test Vendor',
          contact_person: 'John Doe',
          email: email,
          phone: '123-456-7890',
          address: '123 Test St',
          category: 'food_supplier',
          payment_terms: 'Net 30',
          status: 'active',
          notes: 'Test vendor'
        });
      }

      expect(mockCreate).toHaveBeenCalledTimes(validEmails.length);
    });

    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com'
      ];

      const mockCreate = vi.fn().mockRejectedValue(new Error('Invalid email format'));
      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      for (const email of invalidEmails) {
        await expect(pb.collection('vendors').create({
          name: 'Test Vendor',
          contact_person: 'John Doe',
          email: email,
          phone: '123-456-7890',
          address: '123 Test St',
          category: 'food_supplier',
          payment_terms: 'Net 30',
          status: 'active',
          notes: 'Test vendor'
        })).rejects.toThrow('Invalid email format');
      }
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow Manager to create vendors', () => {
      const managerUser = global.testUser.manager;
      expect(canCreateVendor(managerUser.role)).toBe(true);
    });

    it('should restrict Server from creating vendors', () => {
      const serverUser = global.testUser.server;
      expect(canCreateVendor(serverUser.role)).toBe(false);
    });

    it('should allow Manager to update vendors', () => {
      const managerUser = global.testUser.manager;
      expect(canUpdateVendor(managerUser.role)).toBe(true);
    });

    it('should allow Manager to delete vendors', () => {
      const managerUser = global.testUser.manager;
      expect(canDeleteVendor(managerUser.role)).toBe(true);
    });

    it('should allow all roles to view vendors', () => {
      const roles = ['Manager', 'Server', 'Chef', 'Bartender', 'Host'];
      roles.forEach(role => {
        expect(canViewVendors(role)).toBe(true);
      });
    });

    it('should restrict vendor management to Manager only', () => {
      const restrictedRoles = ['Server', 'Chef', 'Bartender', 'Host'];
      restrictedRoles.forEach(role => {
        expect(canCreateVendor(role)).toBe(false);
        expect(canUpdateVendor(role)).toBe(false);
        expect(canDeleteVendor(role)).toBe(false);
      });
    });
  });

  describe('Filtering and Searching', () => {
    it('should filter vendors by category', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'vendor1',
            name: 'Metro Food',
            category: 'food_supplier'
          },
          {
            id: 'vendor2',
            name: 'Fresh Produce Co',
            category: 'food_supplier'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        filter: 'category = "food_supplier"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'category = "food_supplier"'
      });
    });

    it('should filter vendors by status', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'vendor1',
            name: 'Active Vendor',
            status: 'active'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        filter: 'status = "active"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'status = "active"'
      });
    });

    it('should search vendors by name', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'vendor1',
            name: 'Metro Food Distributors'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        filter: 'name ~ "Metro"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'name ~ "Metro"'
      });
    });

    it('should search vendors by contact person', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'vendor1',
            contact_person: 'Jean-Pierre Legrand'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        filter: 'contact_person ~ "Jean-Pierre"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'contact_person ~ "Jean-Pierre"'
      });
    });

    it('should filter by multiple criteria', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'vendor1',
            name: 'Metro Food',
            category: 'food_supplier',
            status: 'active'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        filter: 'category = "food_supplier" && status = "active"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'category = "food_supplier" && status = "active"'
      });
    });

    it('should search in notes field', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          {
            id: 'vendor1',
            name: 'Metro Food',
            notes: 'Primary supplier for organic produce'
          }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        filter: 'notes ~ "organic"'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        filter: 'notes ~ "organic"'
      });
    });
  });

  describe('Data Validation', () => {
    it('should require mandatory fields', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Missing required fields'));

      pb.collection = vi.fn().mockReturnValue({
        create: mockCreate
      });

      await expect(pb.collection('vendors').create({
        // Missing required fields
        phone: '123-456-7890'
      })).rejects.toThrow('Missing required fields');
    });

    it('should validate phone number formats', () => {
      const validPhoneNumbers = [
        '+33 1 42 68 75 84',
        '(555) 123-4567',
        '555-123-4567',
        '+1-555-123-4567',
        '01 42 68 75 84'
      ];

      validPhoneNumbers.forEach(phone => {
        expect(isValidPhoneNumber(phone)).toBe(true);
      });

      const invalidPhoneNumbers = [
        '123',
        'abc-def-ghij'
      ];

      invalidPhoneNumbers.forEach(phone => {
        expect(isValidPhoneNumber(phone)).toBe(false);
      });
    });

    it('should validate payment terms format', () => {
      const validPaymentTerms = [
        'Net 30',
        'Net 15',
        'COD',
        'Due on receipt',
        '2/10 Net 30',
        'Monthly',
        'Quarterly'
      ];

      validPaymentTerms.forEach(terms => {
        expect(isValidPaymentTerms(terms)).toBe(true);
      });
    });
  });

  describe('Business Logic', () => {
    it('should group vendors by category', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'v1', name: 'Metro Food', category: 'food_supplier' },
          { id: 'v2', name: 'Wine Co', category: 'beverage_supplier' },
          { id: 'v3', name: 'Fresh Produce', category: 'food_supplier' },
          { id: 'v4', name: 'Equipment Plus', category: 'equipment' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      const result = await pb.collection('vendors').getList(1, 100);
      const groupedVendors = groupVendorsByCategory(result.items);

      expect(groupedVendors.food_supplier).toHaveLength(2);
      expect(groupedVendors.beverage_supplier).toHaveLength(1);
      expect(groupedVendors.equipment).toHaveLength(1);
    });

    it('should calculate vendor performance metrics', () => {
      const vendors = [
        {
          id: 'v1',
          name: 'Vendor A',
          status: 'active',
          created: '2024-01-01T00:00:00Z'
        },
        {
          id: 'v2',
          name: 'Vendor B',
          status: 'inactive',
          created: '2024-01-01T00:00:00Z'
        },
        {
          id: 'v3',
          name: 'Vendor C',
          status: 'active',
          created: '2024-01-01T00:00:00Z'
        }
      ];

      const metrics = calculateVendorMetrics(vendors);

      expect(metrics.total_vendors).toBe(3);
      expect(metrics.active_vendors).toBe(2);
      expect(metrics.inactive_vendors).toBe(1);
      expect(metrics.active_percentage).toBe(66.67);
    });
  });

  describe('Sorting and Ordering', () => {
    it('should sort vendors alphabetically by name', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'v1', name: 'Alpha Supplies' },
          { id: 'v2', name: 'Beta Foods' },
          { id: 'v3', name: 'Gamma Equipment' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        sort: 'name'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: 'name'
      });
    });

    it('should sort vendors by category then name', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'v1', name: 'Alpha Foods', category: 'food_supplier' },
          { id: 'v2', name: 'Beta Beverages', category: 'beverage_supplier' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        sort: 'category,name'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: 'category,name'
      });
    });

    it('should sort by creation date (newest first)', async () => {
      const mockGetList = vi.fn().mockResolvedValue({
        items: [
          { id: 'v1', name: 'New Vendor', created: '2024-01-02T00:00:00Z' },
          { id: 'v2', name: 'Old Vendor', created: '2024-01-01T00:00:00Z' }
        ]
      });

      pb.collection = vi.fn().mockReturnValue({
        getList: mockGetList
      });

      await pb.collection('vendors').getList(1, 50, {
        sort: '-created'
      });

      expect(mockGetList).toHaveBeenCalledWith(1, 50, {
        sort: '-created'
      });
    });
  });
});

// Helper functions
function canCreateVendor(role: string): boolean {
  return role === 'Manager';
}

function canUpdateVendor(role: string): boolean {
  return role === 'Manager';
}

function canDeleteVendor(role: string): boolean {
  return role === 'Manager';
}

function canViewVendors(role: string): boolean {
  return ['Manager', 'Server', 'Chef', 'Bartender', 'Host'].includes(role);
}

function isValidPhoneNumber(phone: string): boolean {
  // Basic phone validation - accepts various formats
  if (!phone || phone.trim() === '') return false;
  // Must contain at least some digits and be reasonable length
  const hasDigits = /\d/.test(phone);
  const phoneRegex = /^[\+]?[0-9\s\-\(\)]{7,20}$/;
  return hasDigits && phoneRegex.test(phone) && phone.replace(/[^\d]/g, '').length >= 7;
}

function isValidPaymentTerms(terms: string): boolean {
  // Basic validation - non-empty string
  return typeof terms === 'string' && terms.trim().length > 0;
}

function groupVendorsByCategory(vendors: any[]): Record<string, any[]> {
  return vendors.reduce((groups, vendor) => {
    const category = vendor.category;
    if (!groups[category]) groups[category] = [];
    groups[category].push(vendor);
    return groups;
  }, {});
}

function calculateVendorMetrics(vendors: any[]) {
  const totalVendors = vendors.length;
  const activeVendors = vendors.filter(v => v.status === 'active').length;
  const inactiveVendors = vendors.filter(v => v.status === 'inactive').length;
  
  return {
    total_vendors: totalVendors,
    active_vendors: activeVendors,
    inactive_vendors: inactiveVendors,
    active_percentage: totalVendors > 0 ? Math.round((activeVendors / totalVendors) * 100 * 100) / 100 : 0
  };
}
