import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Menu Categories Tests', () => {
  let mockPocketBase: any;
  let validCategoryData: any;
  let sampleCategory: any;

  beforeEach(() => {
    // Mock PocketBase instance with consistent collection mock
    const mockCollection = {
      create: vi.fn(),
      getList: vi.fn(),
      getOne: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    };
    
    mockPocketBase = {
      collection: vi.fn(() => mockCollection)
    };

    // Valid menu category data
    validCategoryData = {
      name: 'Appetizers',
      icon: 'utensils',
      color: '#FF6B35',
      sort_order: 1,
      active: true,
      description: 'Start your meal with our delicious appetizers and small plates'
    };

    // Sample existing category
    sampleCategory = {
      id: 'menu_category_001',
      collectionId: 'menu_categories_collection',
      collectionName: 'menu_categories',
      ...validCategoryData,
      created: '2025-08-06T10:00:00.000Z',
      updated: '2025-08-06T10:00:00.000Z'
    };
  });

  describe('Create Menu Category', () => {
    it('should create category with valid data', async () => {
      const mockCreatedCategory = {
        ...sampleCategory,
        id: 'menu_category_002',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      mockPocketBase.collection().create.mockResolvedValue(mockCreatedCategory);

      const result = await createMenuCategory(mockPocketBase, validCategoryData);

      expect(result.success).toBe(true);
      expect(result.record).toMatchObject({
        name: 'Appetizers',
        icon: 'utensils',
        color: '#FF6B35',
        sort_order: 1,
        active: true
      });
      expect(mockPocketBase.collection).toHaveBeenCalledWith('menu_categories');
      expect(mockPocketBase.collection().create).toHaveBeenCalledWith(validCategoryData);
    });

    it('should create category with different types', async () => {
      const categories = [
        { name: 'Main Courses', icon: 'plate', color: '#4CAF50', sort_order: 2 },
        { name: 'Desserts', icon: 'cake', color: '#FF4081', sort_order: 3 },
        { name: 'Beverages', icon: 'wine-glass', color: '#2196F3', sort_order: 4 },
        { name: 'Sides', icon: 'bowl', color: '#FF9800', sort_order: 5 }
      ];

      for (const category of categories) {
        const categoryData = { ...validCategoryData, ...category };
        const mockRecord = { ...sampleCategory, ...category };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMenuCategory(mockPocketBase, categoryData);

        expect(result.success).toBe(true);
        expect(result.record.name).toBe(category.name);
        expect(result.record.icon).toBe(category.icon);
        expect(result.record.color).toBe(category.color);
      }
    });

    it('should create category without description (optional field)', async () => {
      const noDescriptionData = {
        name: 'Specials',
        icon: 'star',
        color: '#FFC107',
        sort_order: 6,
        active: true
        // description is optional
      };

      const mockRecord = { ...sampleCategory, ...noDescriptionData, description: null };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuCategory(mockPocketBase, noDescriptionData);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Specials');
    });

    it('should create inactive category', async () => {
      const inactiveData = {
        ...validCategoryData,
        name: 'Seasonal Items',
        active: false
      };

      const mockRecord = { ...sampleCategory, ...inactiveData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuCategory(mockPocketBase, inactiveData);

      expect(result.success).toBe(true);
      expect(result.record.active).toBe(false);
    });
  });

  describe('Data Validation', () => {
    it('should reject category with missing required fields', async () => {
      const incompleteData = {
        icon: 'utensils'
        // Missing name, color, sort_order, active
      };

      const result = await createMenuCategory(mockPocketBase, incompleteData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('name is required');
      expect(result.errors).toContain('color is required');
      expect(result.errors).toContain('sort_order is required');
      expect(result.errors).toContain('active is required');
    });

    it('should validate field types', async () => {
      const invalidTypesData = {
        name: 123, // Should be string
        icon: [], // Should be string
        color: true, // Should be string
        sort_order: 'not a number', // Should be number
        active: 'yes', // Should be boolean
        description: 456 // Should be string
      };

      const result = await createMenuCategory(mockPocketBase, invalidTypesData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('name must be a string');
      expect(result.errors).toContain('icon must be a string');
      expect(result.errors).toContain('color must be a string');
      expect(result.errors).toContain('sort_order must be a number');
      expect(result.errors).toContain('active must be a boolean');
      expect(result.errors).toContain('description must be a string');
    });

    it('should validate field lengths', async () => {
      const invalidLengthData = {
        name: 'A', // Too short
        icon: 'A'.repeat(51), // Too long
        color: '#FF', // Too short
        sort_order: 1,
        active: true,
        description: 'A'.repeat(501) // Too long
      };

      const result = await createMenuCategory(mockPocketBase, invalidLengthData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('name must be at least 2 characters');
      expect(result.errors).toContain('icon must not exceed 50 characters');
      expect(result.errors).toContain('color must be a valid hex color');
      expect(result.errors).toContain('description must not exceed 500 characters');
    });

    it('should validate color format', async () => {
      const invalidColors = [
        { color: 'red' }, // Not hex
        { color: '#FF' }, // Too short
        { color: '#GGGGGG' }, // Invalid hex
        { color: 'FF6B35' }, // Missing #
        { color: '#FF6B35AA' } // Too long
      ];

      for (const colorData of invalidColors) {
        const categoryData = { ...validCategoryData, ...colorData };
        const result = await createMenuCategory(mockPocketBase, categoryData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('color must be a valid hex color');
      }
    });

    it('should accept valid color formats', async () => {
      const validColors = ['#FF6B35', '#ffffff', '#000000', '#123ABC'];

      for (const color of validColors) {
        const categoryData = { ...validCategoryData, color };
        const mockRecord = { ...sampleCategory, color };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMenuCategory(mockPocketBase, categoryData);

        expect(result.success).toBe(true);
        expect(result.record.color).toBe(color);
      }
    });

    it('should validate sort_order range', async () => {
      const invalidSortOrders = [
        { sort_order: -1 }, // Negative
        { sort_order: 0 }, // Zero
        { sort_order: 1001 } // Too high
      ];

      for (const sortData of invalidSortOrders) {
        const categoryData = { ...validCategoryData, ...sortData };
        const result = await createMenuCategory(mockPocketBase, categoryData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('sort_order must be between 1 and 1000');
      }
    });
  });

  describe('Update Menu Category', () => {
    it('should update category name', async () => {
      const updateData = {
        name: 'Starters & Appetizers'
      };

      const updatedRecord = { ...sampleCategory, ...updateData, updated: new Date().toISOString() };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuCategory(mockPocketBase, 'menu_category_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Starters & Appetizers');
      expect(mockPocketBase.collection().update).toHaveBeenCalledWith('menu_category_001', updateData);
    });

    it('should update category status', async () => {
      const updateData = {
        active: false
      };

      const updatedRecord = { ...sampleCategory, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuCategory(mockPocketBase, 'menu_category_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.active).toBe(false);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        name: 'Premium Appetizers',
        color: '#8B0000',
        sort_order: 10,
        description: 'Our finest selection of gourmet appetizers'
      };

      const updatedRecord = { ...sampleCategory, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuCategory(mockPocketBase, 'menu_category_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Premium Appetizers');
      expect(result.record.color).toBe('#8B0000');
      expect(result.record.sort_order).toBe(10);
    });

    it('should reorder categories', async () => {
      const reorderUpdates = [
        { id: 'cat_001', sort_order: 3 },
        { id: 'cat_002', sort_order: 1 },
        { id: 'cat_003', sort_order: 2 }
      ];

      for (const update of reorderUpdates) {
        const updatedRecord = { ...sampleCategory, ...update };
        mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

        const result = await updateMenuCategory(mockPocketBase, update.id, { sort_order: update.sort_order });

        expect(result.success).toBe(true);
        expect(result.record.sort_order).toBe(update.sort_order);
      }
    });
  });

  describe('Retrieve Menu Categories', () => {
    it('should get category by ID', async () => {
      mockPocketBase.collection().getOne.mockResolvedValue(sampleCategory);

      const result = await getMenuCategory(mockPocketBase, 'menu_category_001');

      expect(result.success).toBe(true);
      expect(result.record.id).toBe('menu_category_001');
      expect(result.record.name).toBe('Appetizers');
    });

    it('should list active categories only', async () => {
      const activeCategoriesList = {
        items: [
          { ...sampleCategory, active: true },
          { ...sampleCategory, id: 'cat_002', name: 'Main Courses', active: true }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(activeCategoriesList);

      const result = await getMenuCategoriesList(mockPocketBase, {
        filter: 'active = true',
        sort: 'sort_order'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
      expect(result.records.items.every((item: any) => item.active === true)).toBe(true);
    });

    it('should list categories sorted by sort_order', async () => {
      const sortedCategoriesList = {
        items: [
          { ...sampleCategory, sort_order: 1, name: 'Appetizers' },
          { ...sampleCategory, id: 'cat_002', sort_order: 2, name: 'Main Courses' },
          { ...sampleCategory, id: 'cat_003', sort_order: 3, name: 'Desserts' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 3,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(sortedCategoriesList);

      const result = await getMenuCategoriesList(mockPocketBase, {
        sort: 'sort_order'
      });

      expect(result.success).toBe(true);
      expect(result.records.items[0].sort_order).toBe(1);
      expect(result.records.items[1].sort_order).toBe(2);
      expect(result.records.items[2].sort_order).toBe(3);
    });

    it('should get categories with menu items count expansion', async () => {
      const expandedCategories = {
        items: [
          {
            ...sampleCategory,
            expand: {
              'menu_items(category)': [
                { id: 'item_001', name: 'Bruschetta' },
                { id: 'item_002', name: 'Calamari' }
              ]
            }
          }
        ],
        page: 1,
        perPage: 20,
        totalItems: 1,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(expandedCategories);

      const result = await getMenuCategoriesList(mockPocketBase, {
        expand: 'menu_items(category)'
      });

      expect(result.success).toBe(true);
      expect(result.records.items[0].expand['menu_items(category)']).toHaveLength(2);
    });
  });

  describe('Delete Menu Category', () => {
    it('should delete category successfully', async () => {
      mockPocketBase.collection().delete.mockResolvedValue(true);

      const result = await deleteMenuCategory(mockPocketBase, 'menu_category_001');

      expect(result.success).toBe(true);
      expect(mockPocketBase.collection().delete).toHaveBeenCalledWith('menu_category_001');
    });

    it('should handle delete of non-existent category', async () => {
      const notFoundError = new Error('Category not found');
      notFoundError.status = 404;
      mockPocketBase.collection().delete.mockRejectedValue(notFoundError);

      const result = await deleteMenuCategory(mockPocketBase, 'nonexistent_category');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Category not found');
    });

    it('should prevent deletion of category with menu items', async () => {
      const result = await deleteMenuCategory(mockPocketBase, 'menu_category_001', true);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot delete category that contains menu items');
    });
  });

  describe('Business Logic', () => {
    it('should calculate category statistics', () => {
      const categories = [
        { active: true, sort_order: 1 },
        { active: true, sort_order: 2 },
        { active: false, sort_order: 3 },
        { active: true, sort_order: 4 }
      ];

      const stats = calculateCategoryStats(categories);

      expect(stats.total).toBe(4);
      expect(stats.active).toBe(3);
      expect(stats.inactive).toBe(1);
      expect(stats.active_percentage).toBe(75);
    });

    it('should suggest next sort_order', () => {
      const categories = [
        { sort_order: 1 },
        { sort_order: 2 },
        { sort_order: 4 }
      ];

      const nextOrder = getNextSortOrder(categories);
      expect(nextOrder).toBe(5);
    });

    it('should validate sort_order uniqueness', () => {
      const categories = [
        { id: 'cat_001', sort_order: 1 },
        { id: 'cat_002', sort_order: 2 },
        { id: 'cat_003', sort_order: 3 }
      ];

      expect(isSortOrderUnique(categories, 4)).toBe(true);
      expect(isSortOrderUnique(categories, 2)).toBe(false);
      expect(isSortOrderUnique(categories, 2, 'cat_002')).toBe(true); // Same category
    });

    it('should generate category display info', () => {
      const category = {
        name: 'Appetizers',
        icon: 'utensils',
        color: '#FF6B35',
        active: true
      };

      const displayInfo = generateCategoryDisplayInfo(category);

      expect(displayInfo.badge_style).toContain('background-color: #FF6B35');
      expect(displayInfo.icon_class).toContain('utensils');
      expect(displayInfo.status_text).toBe('Active');
      expect(displayInfo.status_class).toBe('active');
    });
  });

  describe('Error Handling', () => {
    it('should handle PocketBase API errors', async () => {
      const apiError = new Error('Connection failed');
      mockPocketBase.collection().create.mockRejectedValue(apiError);

      const result = await createMenuCategory(mockPocketBase, validCategoryData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create menu category');
    });

    it('should handle validation errors from PocketBase', async () => {
      const validationError = new Error('Validation failed');
      validationError.status = 400;
      validationError.data = {
        name: { message: 'Name is required' },
        sort_order: { message: 'Sort order must be unique' }
      };
      mockPocketBase.collection().create.mockRejectedValue(validationError);

      const result = await createMenuCategory(mockPocketBase, {});

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

// Implementation functions for menu categories

async function createMenuCategory(pb: any, categoryData: any) {
  try {
    const validation = validateMenuCategoryData(categoryData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('menu_categories').create(categoryData);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    if (error.status === 400 && error.data) {
      return {
        success: false,
        validation_errors: Object.fromEntries(
          Object.entries(error.data).map(([key, value]: [string, any]) => [
            key,
            value.message
          ])
        )
      };
    }
    
    return {
      success: false,
      error: `Failed to create menu category: ${error.message}`
    };
  }
}

async function updateMenuCategory(pb: any, categoryId: string, updateData: any) {
  try {
    const validation = validateMenuCategoryData(updateData, true);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('menu_categories').update(categoryId, updateData);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to update menu category: ${error.message}`
    };
  }
}

async function getMenuCategory(pb: any, categoryId: string) {
  try {
    const record = await pb.collection('menu_categories').getOne(categoryId);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve menu category: ${error.message}`
    };
  }
}

async function getMenuCategoriesList(pb: any, options: any = {}, page = 1, perPage = 20) {
  try {
    const records = await pb.collection('menu_categories').getList(page, perPage, options);
    
    return {
      success: true,
      records
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve menu categories: ${error.message}`
    };
  }
}

async function deleteMenuCategory(pb: any, categoryId: string, hasMenuItems = false) {
  try {
    // Business rule: prevent deletion of categories with menu items
    if (hasMenuItems) {
      return {
        success: false,
        error: 'Cannot delete category that contains menu items'
      };
    }

    await pb.collection('menu_categories').delete(categoryId);
    
    return {
      success: true
    };
  } catch (error: any) {
    if (error.status === 404) {
      return {
        success: false,
        error: 'Category not found'
      };
    }
    
    return {
      success: false,
      error: `Failed to delete menu category: ${error.message}`
    };
  }
}

function validateMenuCategoryData(data: any, isUpdate = false) {
  const errors: string[] = [];
  const requiredFields = ['name', 'color', 'sort_order', 'active'];

  // Check required fields (only for creation, not updates)
  if (!isUpdate) {
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || (typeof data[field] === 'string' && data[field].trim() === '')) {
        errors.push(`${field} is required`);
      }
    }
  }

  // Validate field types
  if (data.name !== undefined && typeof data.name !== 'string') {
    errors.push('name must be a string');
  }
  if (data.icon !== undefined && data.icon !== null && typeof data.icon !== 'string') {
    errors.push('icon must be a string');
  }
  if (data.color !== undefined && typeof data.color !== 'string') {
    errors.push('color must be a string');
  }
  if (data.sort_order !== undefined && typeof data.sort_order !== 'number') {
    errors.push('sort_order must be a number');
  }
  if (data.active !== undefined && typeof data.active !== 'boolean') {
    errors.push('active must be a boolean');
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    errors.push('description must be a string');
  }

  // Validate field lengths
  if (data.name && data.name.length < 2) {
    errors.push('name must be at least 2 characters');
  }
  if (data.name && data.name.length > 100) {
    errors.push('name must not exceed 100 characters');
  }
  if (data.icon && data.icon.length > 50) {
    errors.push('icon must not exceed 50 characters');
  }
  if (data.description && data.description.length > 500) {
    errors.push('description must not exceed 500 characters');
  }

  // Validate color format (hex color)
  if (data.color) {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexColorRegex.test(data.color)) {
      errors.push('color must be a valid hex color');
    }
  }

  // Validate sort_order range
  if (data.sort_order !== undefined) {
    if (data.sort_order < 1 || data.sort_order > 1000) {
      errors.push('sort_order must be between 1 and 1000');
    }
  }

  return { isValid: errors.length === 0, errors };
}

function calculateCategoryStats(categories: any[]) {
  const total = categories.length;
  const active = categories.filter(cat => cat.active).length;
  const inactive = total - active;
  const active_percentage = total > 0 ? Math.round((active / total) * 100) : 0;

  return {
    total,
    active,
    inactive,
    active_percentage
  };
}

function getNextSortOrder(categories: any[]) {
  const maxOrder = Math.max(...categories.map(cat => cat.sort_order), 0);
  return maxOrder + 1;
}

function isSortOrderUnique(categories: any[], sortOrder: number, excludeId?: string) {
  return !categories.some(cat => 
    cat.sort_order === sortOrder && 
    (!excludeId || cat.id !== excludeId)
  );
}

function generateCategoryDisplayInfo(category: any) {
  return {
    badge_style: `background-color: ${category.color}; color: white;`,
    icon_class: `icon-${category.icon}`,
    status_text: category.active ? 'Active' : 'Inactive',
    status_class: category.active ? 'active' : 'inactive'
  };
}
