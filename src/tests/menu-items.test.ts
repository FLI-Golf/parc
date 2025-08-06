import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Menu Items Tests', () => {
  let mockPocketBase: any;
  let validItemData: any;
  let sampleItem: any;

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

    // Valid menu item data
    validItemData = {
      name: 'Grilled Salmon',
      description: 'Fresh Atlantic salmon grilled to perfection, served with lemon herb butter, seasonal vegetables, and wild rice pilaf',
      category: 'main_course',
      price: 28.95,
      cost: 12.50,
      ingredients: 'Atlantic salmon, lemon, herbs, butter, seasonal vegetables, wild rice, vegetable stock',
      allergens: ['fish'],
      preparation_time: 25,
      available: true,
      image: 'grilled-salmon.jpg'
    };

    // Sample existing item
    sampleItem = {
      id: 'menu_item_001',
      collectionId: 'menu_items_collection',
      collectionName: 'menu_items',
      ...validItemData,
      created: '2025-08-06T10:00:00.000Z',
      updated: '2025-08-06T10:00:00.000Z'
    };
  });

  describe('Create Menu Item', () => {
    it('should create item with valid data', async () => {
      const mockCreatedItem = {
        ...sampleItem,
        id: 'menu_item_002',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      mockPocketBase.collection().create.mockResolvedValue(mockCreatedItem);

      const result = await createMenuItem(mockPocketBase, validItemData);

      expect(result.success).toBe(true);
      expect(result.record).toMatchObject({
        name: 'Grilled Salmon',
        category: 'main_course',
        price: 28.95,
        cost: 12.50,
        available: true
      });
      expect(mockPocketBase.collection).toHaveBeenCalledWith('menu_items');
      expect(mockPocketBase.collection().create).toHaveBeenCalledWith(validItemData);
    });

    it('should create items with different categories', async () => {
      const categories = ['appetizer', 'main_course', 'dessert', 'beverage', 'special', 'side_dish'];

      for (const category of categories) {
        const itemData = {
          ...validItemData,
          name: `Test ${category}`,
          category
        };

        const mockRecord = { ...sampleItem, ...itemData };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMenuItem(mockPocketBase, itemData);

        expect(result.success).toBe(true);
        expect(result.record.category).toBe(category);
      }
    });

    it('should create items with different allergens', async () => {
      const allergenCombinations = [
        ['gluten', 'dairy'],
        ['nuts', 'eggs'],
        ['shellfish', 'fish', 'dairy'],
        ['soy', 'sesame'],
        [] // No allergens
      ];

      for (const allergens of allergenCombinations) {
        const itemData = {
          ...validItemData,
          name: `Item with ${allergens.join(', ') || 'no'} allergens`,
          allergens
        };

        const mockRecord = { ...sampleItem, allergens };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMenuItem(mockPocketBase, itemData);

        expect(result.success).toBe(true);
        expect(result.record.allergens).toEqual(allergens);
      }
    });

    it('should create item without optional fields', async () => {
      const minimalData = {
        name: 'Simple Salad',
        category: 'appetizer',
        price: 12.50,
        available: true
        // Optional fields: description, cost, ingredients, allergens, preparation_time, image
      };

      const mockRecord = { 
        ...sampleItem, 
        ...minimalData,
        description: null,
        cost: null,
        ingredients: null,
        allergens: [],
        preparation_time: null,
        image: null
      };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuItem(mockPocketBase, minimalData);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Simple Salad');
    });

    it('should create unavailable item', async () => {
      const unavailableData = {
        ...validItemData,
        name: 'Seasonal Special',
        available: false
      };

      const mockRecord = { ...sampleItem, ...unavailableData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuItem(mockPocketBase, unavailableData);

      expect(result.success).toBe(true);
      expect(result.record.available).toBe(false);
    });
  });

  describe('Data Validation', () => {
    it('should reject item with missing required fields', async () => {
      const incompleteData = {
        description: 'Some description'
        // Missing name, category, price, available
      };

      const result = await createMenuItem(mockPocketBase, incompleteData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('name is required');
      expect(result.errors).toContain('category is required');
      expect(result.errors).toContain('price is required');
      expect(result.errors).toContain('available is required');
    });

    it('should validate field types', async () => {
      const invalidTypesData = {
        name: 123, // Should be string
        description: [], // Should be string
        category: true, // Should be string
        price: 'not a number', // Should be number
        cost: 'also not a number', // Should be number
        ingredients: 456, // Should be string
        allergens: 'should be array', // Should be array
        preparation_time: 'not a number', // Should be number
        available: 'yes', // Should be boolean
        image: 789 // Should be string
      };

      const validation = validateMenuItemData(invalidTypesData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('name must be a string');
      expect(validation.errors).toContain('description must be a string');
      expect(validation.errors).toContain('category must be a string');
      expect(validation.errors).toContain('price must be a number');
      expect(validation.errors).toContain('cost must be a number');
      expect(validation.errors).toContain('ingredients must be a string');
      expect(validation.errors).toContain('allergens must be an array');
      expect(validation.errors).toContain('preparation_time must be a number');
      expect(validation.errors).toContain('available must be a boolean');
      expect(validation.errors).toContain('image must be a string');
    });

    it('should validate category values', async () => {
      const invalidCategoryData = {
        ...validItemData,
        category: 'invalid_category'
      };

      const result = await createMenuItem(mockPocketBase, invalidCategoryData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('category must be one of: appetizer, main_course, dessert, beverage, special, side_dish');
    });

    it('should validate allergen values', async () => {
      const invalidAllergenData = {
        ...validItemData,
        allergens: ['gluten', 'invalid_allergen', 'dairy']
      };

      const result = await createMenuItem(mockPocketBase, invalidAllergenData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('allergens must only contain: gluten, dairy, nuts, shellfish, eggs, soy, fish, sesame');
    });

    it('should validate price and cost ranges', async () => {
      const invalidPriceData = [
        { price: -5.00 }, // Negative price
        { price: 0 }, // Zero price
        { cost: -2.50 }, // Negative cost
        { preparation_time: -10 }, // Negative time
        { preparation_time: 241 } // Over 4 hours
      ];

      for (const data of invalidPriceData) {
        const itemData = { ...validItemData, ...data };
        const result = await createMenuItem(mockPocketBase, itemData);

        expect(result.success).toBe(false);
      }
    });

    it('should validate field lengths', async () => {
      const invalidLengthData = {
        name: 'A', // Too short
        description: 'A'.repeat(1001), // Too long
        ingredients: 'A'.repeat(2001), // Too long
        image: 'A'.repeat(256) // Too long
      };

      const validation = validateMenuItemData({ ...validItemData, ...invalidLengthData });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('name must be at least 2 characters');
      expect(validation.errors).toContain('description must not exceed 1000 characters');
      expect(validation.errors).toContain('ingredients must not exceed 2000 characters');
      expect(validation.errors).toContain('image must not exceed 255 characters');
    });

    it('should validate profit margin warnings', async () => {
      const lowMarginData = {
        ...validItemData,
        price: 15.00,
        cost: 14.00 // Only $1 profit (6.67% margin)
      };

      const result = await createMenuItem(mockPocketBase, lowMarginData);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Low profit margin: consider reviewing pricing');
    });
  });

  describe('Update Menu Item', () => {
    it('should update item price', async () => {
      const updateData = {
        price: 32.95
      };

      const updatedRecord = { ...sampleItem, ...updateData, updated: new Date().toISOString() };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuItem(mockPocketBase, 'menu_item_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.price).toBe(32.95);
      expect(mockPocketBase.collection().update).toHaveBeenCalledWith('menu_item_001', updateData);
    });

    it('should update item availability', async () => {
      const updateData = {
        available: false
      };

      const updatedRecord = { ...sampleItem, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuItem(mockPocketBase, 'menu_item_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.available).toBe(false);
    });

    it('should update allergen information', async () => {
      const updateData = {
        allergens: ['fish', 'dairy', 'gluten']
      };

      const updatedRecord = { ...sampleItem, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuItem(mockPocketBase, 'menu_item_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.allergens).toEqual(['fish', 'dairy', 'gluten']);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        name: 'Pan-Seared Salmon',
        price: 30.95,
        description: 'Fresh Atlantic salmon pan-seared with herbs and finished with citrus butter',
        preparation_time: 22
      };

      const updatedRecord = { ...sampleItem, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuItem(mockPocketBase, 'menu_item_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Pan-Seared Salmon');
      expect(result.record.price).toBe(30.95);
    });
  });

  describe('Retrieve Menu Items', () => {
    it('should get item by ID', async () => {
      mockPocketBase.collection().getOne.mockResolvedValue(sampleItem);

      const result = await getMenuItem(mockPocketBase, 'menu_item_001');

      expect(result.success).toBe(true);
      expect(result.record.id).toBe('menu_item_001');
      expect(result.record.name).toBe('Grilled Salmon');
    });

    it('should list available items only', async () => {
      const availableItemsList = {
        items: [
          { ...sampleItem, available: true },
          { ...sampleItem, id: 'item_002', name: 'Chicken Parmesan', available: true }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(availableItemsList);

      const result = await getMenuItemsList(mockPocketBase, {
        filter: 'available = true',
        sort: 'name'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
      expect(result.records.items.every((item: any) => item.available === true)).toBe(true);
    });

    it('should list items by category', async () => {
      const categoryItemsList = {
        items: [
          { ...sampleItem, category: 'main_course' },
          { ...sampleItem, id: 'item_002', category: 'main_course', name: 'Beef Tenderloin' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(categoryItemsList);

      const result = await getMenuItemsList(mockPocketBase, {
        filter: 'category = "main_course"',
        sort: 'price'
      });

      expect(result.success).toBe(true);
      expect(result.records.items.every((item: any) => item.category === 'main_course')).toBe(true);
    });

    it('should search items by name', async () => {
      const searchResults = {
        items: [
          { ...sampleItem, name: 'Grilled Salmon' },
          { ...sampleItem, id: 'item_002', name: 'Grilled Chicken' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(searchResults);

      const result = await getMenuItemsList(mockPocketBase, {
        filter: 'name ~ "Grilled"'
      });

      expect(result.success).toBe(true);
      expect(result.records.items.every((item: any) => item.name.includes('Grilled'))).toBe(true);
    });

    it('should filter items by allergens', async () => {
      const allergenFreeItems = {
        items: [
          { ...sampleItem, allergens: [] },
          { ...sampleItem, id: 'item_002', allergens: ['soy'] }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(allergenFreeItems);

      const result = await getMenuItemsList(mockPocketBase, {
        filter: 'allergens !~ "gluten" && allergens !~ "dairy" && allergens !~ "nuts"'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
    });

    it('should get items with category expansion', async () => {
      const expandedItems = {
        items: [
          {
            ...sampleItem,
            expand: {
              category: {
                id: 'cat_001',
                name: 'Main Courses',
                color: '#4CAF50'
              }
            }
          }
        ],
        page: 1,
        perPage: 20,
        totalItems: 1,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(expandedItems);

      const result = await getMenuItemsList(mockPocketBase, {
        expand: 'category'
      });

      expect(result.success).toBe(true);
      expect(result.records.items[0].expand.category.name).toBe('Main Courses');
    });
  });

  describe('Delete Menu Item', () => {
    it('should delete item successfully', async () => {
      mockPocketBase.collection().delete.mockResolvedValue(true);

      const result = await deleteMenuItem(mockPocketBase, 'menu_item_001');

      expect(result.success).toBe(true);
      expect(mockPocketBase.collection().delete).toHaveBeenCalledWith('menu_item_001');
    });

    it('should handle delete of non-existent item', async () => {
      const notFoundError = new Error('Item not found');
      notFoundError.status = 404;
      mockPocketBase.collection().delete.mockRejectedValue(notFoundError);

      const result = await deleteMenuItem(mockPocketBase, 'nonexistent_item');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Item not found');
    });
  });

  describe('Business Logic and Analytics', () => {
    it('should calculate menu analytics', () => {
      const items = [
        { price: 15.99, cost: 6.50, category: 'appetizer', available: true },
        { price: 28.99, cost: 12.00, category: 'main_course', available: true },
        { price: 8.99, cost: 3.25, category: 'dessert', available: false },
        { price: 24.99, cost: 10.50, category: 'main_course', available: true }
      ];

      const analytics = calculateMenuAnalytics(items);

      expect(analytics.total_items).toBe(4);
      expect(analytics.available_items).toBe(3);
      expect(analytics.average_price).toBe(19.74);
      expect(analytics.average_profit_margin).toBeGreaterThan(50);
      expect(analytics.by_category.main_course).toBe(2);
    });

    it('should calculate profit margins', () => {
      const items = [
        { price: 20.00, cost: 8.00 }, // 60% margin
        { price: 15.00, cost: 12.00 }, // 20% margin
        { price: 25.00, cost: 10.00 }  // 60% margin
      ];

      const margins = items.map(calculateProfitMargin);

      expect(margins[0]).toBe(60);
      expect(margins[1]).toBe(20);
      expect(margins[2]).toBe(60);
    });

    it('should identify popular allergens', () => {
      const items = [
        { allergens: ['gluten', 'dairy'] },
        { allergens: ['gluten', 'eggs'] },
        { allergens: ['dairy', 'nuts'] },
        { allergens: [] }
      ];

      const allergenStats = analyzeAllergens(items);

      expect(allergenStats.gluten).toBe(2);
      expect(allergenStats.dairy).toBe(2);
      expect(allergenStats.eggs).toBe(1);
      expect(allergenStats.nuts).toBe(1);
    });

    it('should suggest menu pricing', () => {
      const item = {
        cost: 8.50,
        category: 'main_course',
        preparation_time: 25
      };

      const suggestion = suggestPricing(item);

      expect(suggestion.minimum_price).toBeGreaterThan(item.cost);
      expect(suggestion.recommended_price).toBeGreaterThan(suggestion.minimum_price);
      expect(suggestion.profit_margin).toBeGreaterThan(40);
    });

    it('should group items by preparation time', () => {
      const items = [
        { name: 'Salad', preparation_time: 8 },
        { name: 'Pasta', preparation_time: 15 },
        { name: 'Steak', preparation_time: 25 },
        { name: 'Soup', preparation_time: 5 }
      ];

      const grouped = groupByPreparationTime(items);

      expect(grouped.quick).toHaveLength(2); // <= 10 minutes
      expect(grouped.medium).toHaveLength(1); // 11-20 minutes
      expect(grouped.slow).toHaveLength(1); // > 20 minutes
    });
  });

  describe('Error Handling', () => {
    it('should handle PocketBase API errors', async () => {
      const apiError = new Error('Connection failed');
      mockPocketBase.collection().create.mockRejectedValue(apiError);

      const result = await createMenuItem(mockPocketBase, validItemData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create menu item');
    });

    it('should handle validation errors from PocketBase', async () => {
      const validationError = new Error('Validation failed');
      validationError.status = 400;
      validationError.data = {
        name: { message: 'Name is required' },
        price: { message: 'Price must be positive' }
      };
      mockPocketBase.collection().create.mockRejectedValue(validationError);

      const result = await createMenuItem(mockPocketBase, {});

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

// Implementation functions for menu items

async function createMenuItem(pb: any, itemData: any) {
  try {
    const validation = validateMenuItemData(itemData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('menu_items').create(itemData);
    
    return {
      success: true,
      record,
      warnings: validation.warnings || []
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
      error: `Failed to create menu item: ${error.message}`
    };
  }
}

async function updateMenuItem(pb: any, itemId: string, updateData: any) {
  try {
    const validation = validateMenuItemData(updateData, true);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('menu_items').update(itemId, updateData);
    
    return {
      success: true,
      record,
      warnings: validation.warnings || []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to update menu item: ${error.message}`
    };
  }
}

async function getMenuItem(pb: any, itemId: string) {
  try {
    const record = await pb.collection('menu_items').getOne(itemId);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve menu item: ${error.message}`
    };
  }
}

async function getMenuItemsList(pb: any, options: any = {}, page = 1, perPage = 20) {
  try {
    const records = await pb.collection('menu_items').getList(page, perPage, options);
    
    return {
      success: true,
      records
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve menu items: ${error.message}`
    };
  }
}

async function deleteMenuItem(pb: any, itemId: string) {
  try {
    await pb.collection('menu_items').delete(itemId);
    
    return {
      success: true
    };
  } catch (error: any) {
    if (error.status === 404) {
      return {
        success: false,
        error: 'Item not found'
      };
    }
    
    return {
      success: false,
      error: `Failed to delete menu item: ${error.message}`
    };
  }
}

function validateMenuItemData(data: any, isUpdate = false) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredFields = ['name', 'category', 'price', 'available'];
  
  const validCategories = ['appetizer', 'main_course', 'dessert', 'beverage', 'special', 'side_dish'];
  const validAllergens = ['gluten', 'dairy', 'nuts', 'shellfish', 'eggs', 'soy', 'fish', 'sesame'];

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
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    errors.push('description must be a string');
  }
  if (data.category !== undefined && typeof data.category !== 'string') {
    errors.push('category must be a string');
  }
  if (data.price !== undefined && typeof data.price !== 'number') {
    errors.push('price must be a number');
  }
  if (data.cost !== undefined && data.cost !== null && typeof data.cost !== 'number') {
    errors.push('cost must be a number');
  }
  if (data.ingredients !== undefined && data.ingredients !== null && typeof data.ingredients !== 'string') {
    errors.push('ingredients must be a string');
  }
  if (data.allergens !== undefined && !Array.isArray(data.allergens)) {
    errors.push('allergens must be an array');
  }
  if (data.preparation_time !== undefined && data.preparation_time !== null && typeof data.preparation_time !== 'number') {
    errors.push('preparation_time must be a number');
  }
  if (data.available !== undefined && typeof data.available !== 'boolean') {
    errors.push('available must be a boolean');
  }
  if (data.image !== undefined && data.image !== null && typeof data.image !== 'string') {
    errors.push('image must be a string');
  }

  // Validate field lengths
  if (data.name && data.name.length < 2) {
    errors.push('name must be at least 2 characters');
  }
  if (data.name && data.name.length > 100) {
    errors.push('name must not exceed 100 characters');
  }
  if (data.description && data.description.length > 1000) {
    errors.push('description must not exceed 1000 characters');
  }
  if (data.ingredients && data.ingredients.length > 2000) {
    errors.push('ingredients must not exceed 2000 characters');
  }
  if (data.image && data.image.length > 255) {
    errors.push('image must not exceed 255 characters');
  }

  // Validate select field values
  if (data.category && !validCategories.includes(data.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`);
  }

  // Validate allergens
  if (data.allergens && Array.isArray(data.allergens)) {
    const invalidAllergens = data.allergens.filter((allergen: string) => !validAllergens.includes(allergen));
    if (invalidAllergens.length > 0) {
      errors.push(`allergens must only contain: ${validAllergens.join(', ')}`);
    }
  }

  // Validate numeric ranges
  if (data.price !== undefined && data.price <= 0) {
    errors.push('price must be greater than 0');
  }
  if (data.cost !== undefined && data.cost !== null && data.cost < 0) {
    errors.push('cost must be non-negative');
  }
  if (data.preparation_time !== undefined && data.preparation_time !== null) {
    if (data.preparation_time < 0 || data.preparation_time > 240) {
      errors.push('preparation_time must be between 0 and 240 minutes');
    }
  }

  // Business logic warnings
  if (data.price && data.cost) {
    const margin = ((data.price - data.cost) / data.price) * 100;
    if (margin < 30) {
      warnings.push('Low profit margin: consider reviewing pricing');
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function calculateMenuAnalytics(items: any[]) {
  const total_items = items.length;
  const available_items = items.filter(item => item.available).length;
  const average_price = items.reduce((sum, item) => sum + item.price, 0) / total_items;
  
  const margins = items.filter(item => item.cost).map(item => 
    ((item.price - item.cost) / item.price) * 100
  );
  const average_profit_margin = margins.length > 0 ? 
    margins.reduce((sum, margin) => sum + margin, 0) / margins.length : 0;

  const by_category = items.reduce((acc: any, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  return {
    total_items,
    available_items,
    average_price: Number(average_price.toFixed(2)),
    average_profit_margin: Number(average_profit_margin.toFixed(2)),
    by_category
  };
}

function calculateProfitMargin(item: any) {
  if (!item.cost || item.cost === 0) return 0;
  return Number((((item.price - item.cost) / item.price) * 100).toFixed(2));
}

function analyzeAllergens(items: any[]) {
  const allergenCounts: { [key: string]: number } = {};
  
  items.forEach(item => {
    if (item.allergens && Array.isArray(item.allergens)) {
      item.allergens.forEach((allergen: string) => {
        allergenCounts[allergen] = (allergenCounts[allergen] || 0) + 1;
      });
    }
  });

  return allergenCounts;
}

function suggestPricing(item: any) {
  const targetMargin = item.category === 'beverage' ? 70 : 60; // Higher margin for beverages
  const minimum_price = item.cost * 2; // 50% margin minimum
  const recommended_price = item.cost / (1 - targetMargin / 100);
  const profit_margin = ((recommended_price - item.cost) / recommended_price) * 100;

  return {
    minimum_price: Number(minimum_price.toFixed(2)),
    recommended_price: Number(recommended_price.toFixed(2)),
    profit_margin: Number(profit_margin.toFixed(2))
  };
}

function groupByPreparationTime(items: any[]) {
  const groups = {
    quick: [] as any[], // <= 10 minutes
    medium: [] as any[], // 11-20 minutes
    slow: [] as any[] // > 20 minutes
  };

  items.forEach(item => {
    if (!item.preparation_time) return;
    
    if (item.preparation_time <= 10) {
      groups.quick.push(item);
    } else if (item.preparation_time <= 20) {
      groups.medium.push(item);
    } else {
      groups.slow.push(item);
    }
  });

  return groups;
}
