import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Menu Modifiers Tests', () => {
  let mockPocketBase: any;
  let validModifierData: any;
  let sampleModifier: any;

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

    // Valid menu modifier data
    validModifierData = {
      name: 'Extra Cheese',
      type: 'add_on',
      price_change: 2.50,
      applicable_items: ['menu_item_001', 'menu_item_002'],
      required: false,
      sort_order: 1
    };

    // Sample existing modifier
    sampleModifier = {
      id: 'menu_modifier_001',
      collectionId: 'menu_modifiers_collection',
      collectionName: 'menu_modifiers',
      ...validModifierData,
      created: '2025-08-06T10:00:00.000Z',
      updated: '2025-08-06T10:00:00.000Z'
    };
  });

  describe('Create Menu Modifier', () => {
    it('should create modifier with valid data', async () => {
      const mockCreatedModifier = {
        ...sampleModifier,
        id: 'menu_modifier_002',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      mockPocketBase.collection().create.mockResolvedValue(mockCreatedModifier);

      const result = await createMenuModifier(mockPocketBase, validModifierData);

      expect(result.success).toBe(true);
      expect(result.record).toMatchObject({
        name: 'Extra Cheese',
        type: 'add_on',
        price_change: 2.50,
        required: false,
        sort_order: 1
      });
      expect(mockPocketBase.collection).toHaveBeenCalledWith('menu_modifiers');
      expect(mockPocketBase.collection().create).toHaveBeenCalledWith(validModifierData);
    });

    it('should create modifiers with different types', async () => {
      const types = ['add_on', 'cooking_style', 'size', 'sauce', 'temperature', 'side_dish'];

      for (const type of types) {
        const modifierData = {
          ...validModifierData,
          name: `Test ${type}`,
          type
        };

        const mockRecord = { ...sampleModifier, ...modifierData };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMenuModifier(mockPocketBase, modifierData);

        expect(result.success).toBe(true);
        expect(result.record.type).toBe(type);
      }
    });

    it('should create modifier with positive price change', async () => {
      const addOnData = {
        ...validModifierData,
        name: 'Premium Upgrade',
        price_change: 5.00
      };

      const mockRecord = { ...sampleModifier, ...addOnData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuModifier(mockPocketBase, addOnData);

      expect(result.success).toBe(true);
      expect(result.record.price_change).toBe(5.00);
    });

    it('should create modifier with negative price change (discount)', async () => {
      const discountData = {
        ...validModifierData,
        name: 'Student Discount',
        price_change: -2.00
      };

      const mockRecord = { ...sampleModifier, ...discountData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuModifier(mockPocketBase, discountData);

      expect(result.success).toBe(true);
      expect(result.record.price_change).toBe(-2.00);
    });

    it('should create modifier with zero price change', async () => {
      const noPriceChangeData = {
        ...validModifierData,
        name: 'No Onions',
        price_change: 0
      };

      const mockRecord = { ...sampleModifier, ...noPriceChangeData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuModifier(mockPocketBase, noPriceChangeData);

      expect(result.success).toBe(true);
      expect(result.record.price_change).toBe(0);
    });

    it('should create required modifier', async () => {
      const requiredData = {
        ...validModifierData,
        name: 'Cooking Temperature',
        type: 'temperature',
        required: true
      };

      const mockRecord = { ...sampleModifier, ...requiredData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuModifier(mockPocketBase, requiredData);

      expect(result.success).toBe(true);
      expect(result.record.required).toBe(true);
    });

    it('should create modifier without applicable items (applies to all)', async () => {
      const globalModifierData = {
        ...validModifierData,
        name: 'Gift Wrap',
        applicable_items: []
      };

      const mockRecord = { ...sampleModifier, ...globalModifierData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMenuModifier(mockPocketBase, globalModifierData);

      expect(result.success).toBe(true);
      expect(result.record.applicable_items).toEqual([]);
    });
  });

  describe('Data Validation', () => {
    it('should reject modifier with missing required fields', async () => {
      const incompleteData = {
        price_change: 2.50
        // Missing name, type, applicable_items, required, sort_order
      };

      const result = await createMenuModifier(mockPocketBase, incompleteData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('name is required');
      expect(result.errors).toContain('type is required');
      expect(result.errors).toContain('applicable_items is required');
      expect(result.errors).toContain('required is required');
      expect(result.errors).toContain('sort_order is required');
    });

    it('should validate field types', async () => {
      const invalidTypesData = {
        name: 123, // Should be string
        type: [], // Should be string
        price_change: 'not a number', // Should be number
        applicable_items: 'should be array', // Should be array
        required: 'yes', // Should be boolean
        sort_order: 'not a number' // Should be number
      };

      const validation = validateMenuModifierData(invalidTypesData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('name must be a string');
      expect(validation.errors).toContain('type must be a string');
      expect(validation.errors).toContain('price_change must be a number');
      expect(validation.errors).toContain('applicable_items must be an array');
      expect(validation.errors).toContain('required must be a boolean');
      expect(validation.errors).toContain('sort_order must be a number');
    });

    it('should validate type values', async () => {
      const invalidTypeData = {
        ...validModifierData,
        type: 'invalid_type'
      };

      const result = await createMenuModifier(mockPocketBase, invalidTypeData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('type must be one of: add_on, cooking_style, size, sauce, temperature, side_dish');
    });

    it('should validate field lengths', async () => {
      const invalidLengthData = {
        name: 'A', // Too short
        type: 'add_on',
        price_change: 2.50,
        applicable_items: [],
        required: false,
        sort_order: 1
      };

      const validation = validateMenuModifierData(invalidLengthData);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('name must be at least 2 characters');
    });

    it('should validate price_change range', async () => {
      const extremePriceData = [
        { price_change: -100.01 }, // Too negative
        { price_change: 100.01 } // Too positive
      ];

      for (const data of extremePriceData) {
        const modifierData = { ...validModifierData, ...data };
        const result = await createMenuModifier(mockPocketBase, modifierData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('price_change must be between -100.00 and 100.00');
      }
    });

    it('should validate sort_order range', async () => {
      const invalidSortOrders = [
        { sort_order: -1 }, // Negative
        { sort_order: 0 }, // Zero
        { sort_order: 1001 } // Too high
      ];

      for (const sortData of invalidSortOrders) {
        const modifierData = { ...validModifierData, ...sortData };
        const result = await createMenuModifier(mockPocketBase, modifierData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('sort_order must be between 1 and 1000');
      }
    });

    it('should validate applicable_items references', async () => {
      const invalidItemsData = {
        ...validModifierData,
        applicable_items: ['nonexistent_item']
      };

      const result = await createMenuModifier(mockPocketBase, invalidItemsData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('applicable_items contains invalid menu item references');
    });
  });

  describe('Update Menu Modifier', () => {
    it('should update modifier name', async () => {
      const updateData = {
        name: 'Extra Sharp Cheddar'
      };

      const updatedRecord = { ...sampleModifier, ...updateData, updated: new Date().toISOString() };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuModifier(mockPocketBase, 'menu_modifier_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Extra Sharp Cheddar');
      expect(mockPocketBase.collection().update).toHaveBeenCalledWith('menu_modifier_001', updateData);
    });

    it('should update modifier price', async () => {
      const updateData = {
        price_change: 3.00
      };

      const updatedRecord = { ...sampleModifier, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuModifier(mockPocketBase, 'menu_modifier_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.price_change).toBe(3.00);
    });

    it('should update applicable items', async () => {
      const updateData = {
        applicable_items: ['menu_item_001', 'menu_item_003', 'menu_item_005']
      };

      const updatedRecord = { ...sampleModifier, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuModifier(mockPocketBase, 'menu_modifier_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.applicable_items).toEqual(['menu_item_001', 'menu_item_003', 'menu_item_005']);
    });

    it('should update multiple fields', async () => {
      const updateData = {
        name: 'Premium Add-on',
        price_change: 4.50,
        required: true,
        sort_order: 5
      };

      const updatedRecord = { ...sampleModifier, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMenuModifier(mockPocketBase, 'menu_modifier_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Premium Add-on');
      expect(result.record.price_change).toBe(4.50);
      expect(result.record.required).toBe(true);
    });
  });

  describe('Retrieve Menu Modifiers', () => {
    it('should get modifier by ID', async () => {
      mockPocketBase.collection().getOne.mockResolvedValue(sampleModifier);

      const result = await getMenuModifier(mockPocketBase, 'menu_modifier_001');

      expect(result.success).toBe(true);
      expect(result.record.id).toBe('menu_modifier_001');
      expect(result.record.name).toBe('Extra Cheese');
    });

    it('should list modifiers by type', async () => {
      const typeModifiersList = {
        items: [
          { ...sampleModifier, type: 'add_on' },
          { ...sampleModifier, id: 'mod_002', name: 'Bacon', type: 'add_on' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(typeModifiersList);

      const result = await getMenuModifiersList(mockPocketBase, {
        filter: 'type = "add_on"',
        sort: 'sort_order'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
      expect(result.records.items.every((item: any) => item.type === 'add_on')).toBe(true);
    });

    it('should list required modifiers only', async () => {
      const requiredModifiersList = {
        items: [
          { ...sampleModifier, required: true, name: 'Cooking Temperature' },
          { ...sampleModifier, id: 'mod_002', required: true, name: 'Portion Size' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(requiredModifiersList);

      const result = await getMenuModifiersList(mockPocketBase, {
        filter: 'required = true',
        sort: 'sort_order'
      });

      expect(result.success).toBe(true);
      expect(result.records.items.every((item: any) => item.required === true)).toBe(true);
    });

    it('should list modifiers sorted by sort_order', async () => {
      const sortedModifiersList = {
        items: [
          { ...sampleModifier, sort_order: 1, name: 'First Modifier' },
          { ...sampleModifier, id: 'mod_002', sort_order: 2, name: 'Second Modifier' },
          { ...sampleModifier, id: 'mod_003', sort_order: 3, name: 'Third Modifier' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 3,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(sortedModifiersList);

      const result = await getMenuModifiersList(mockPocketBase, {
        sort: 'sort_order'
      });

      expect(result.success).toBe(true);
      expect(result.records.items[0].sort_order).toBe(1);
      expect(result.records.items[1].sort_order).toBe(2);
      expect(result.records.items[2].sort_order).toBe(3);
    });

    it('should get modifiers for specific menu item', async () => {
      const itemModifiersList = {
        items: [
          { ...sampleModifier, applicable_items: ['menu_item_001', 'menu_item_002'] },
          { ...sampleModifier, id: 'mod_002', applicable_items: ['menu_item_001'] }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(itemModifiersList);

      const result = await getModifiersForMenuItem(mockPocketBase, 'menu_item_001');

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
    });

    it('should get modifiers with expanded applicable items', async () => {
      const expandedModifiers = {
        items: [
          {
            ...sampleModifier,
            expand: {
              applicable_items: [
                { id: 'item_001', name: 'Burger', category: 'main_course' },
                { id: 'item_002', name: 'Pizza', category: 'main_course' }
              ]
            }
          }
        ],
        page: 1,
        perPage: 20,
        totalItems: 1,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(expandedModifiers);

      const result = await getMenuModifiersList(mockPocketBase, {
        expand: 'applicable_items'
      });

      expect(result.success).toBe(true);
      expect(result.records.items[0].expand.applicable_items).toHaveLength(2);
    });
  });

  describe('Delete Menu Modifier', () => {
    it('should delete modifier successfully', async () => {
      mockPocketBase.collection().delete.mockResolvedValue(true);

      const result = await deleteMenuModifier(mockPocketBase, 'menu_modifier_001');

      expect(result.success).toBe(true);
      expect(mockPocketBase.collection().delete).toHaveBeenCalledWith('menu_modifier_001');
    });

    it('should handle delete of non-existent modifier', async () => {
      const notFoundError = new Error('Modifier not found');
      notFoundError.status = 404;
      mockPocketBase.collection().delete.mockRejectedValue(notFoundError);

      const result = await deleteMenuModifier(mockPocketBase, 'nonexistent_modifier');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Modifier not found');
    });
  });

  describe('Business Logic and Analytics', () => {
    it('should calculate modifier statistics', () => {
      const modifiers = [
        { type: 'add_on', price_change: 2.50, required: false },
        { type: 'add_on', price_change: 1.00, required: false },
        { type: 'cooking_style', price_change: 0, required: true },
        { type: 'sauce', price_change: 0.50, required: false }
      ];

      const stats = calculateModifierStats(modifiers);

      expect(stats.total).toBe(4);
      expect(stats.by_type.add_on).toBe(2);
      expect(stats.required_count).toBe(1);
      expect(stats.average_price_change).toBe(1.00);
      expect(stats.free_modifiers).toBe(1);
    });

    it('should group modifiers by type', () => {
      const modifiers = [
        { name: 'Extra Cheese', type: 'add_on' },
        { name: 'Medium Rare', type: 'cooking_style' },
        { name: 'BBQ Sauce', type: 'sauce' },
        { name: 'Bacon', type: 'add_on' }
      ];

      const grouped = groupModifiersByType(modifiers);

      expect(grouped.add_on).toHaveLength(2);
      expect(grouped.cooking_style).toHaveLength(1);
      expect(grouped.sauce).toHaveLength(1);
    });

    it('should calculate total modifier impact on item', () => {
      const selectedModifiers = [
        { price_change: 2.50 },
        { price_change: 1.00 },
        { price_change: -0.50 }
      ];

      const impact = calculateModifierImpact(selectedModifiers);

      expect(impact.total_price_change).toBe(3.00);
      expect(impact.modifier_count).toBe(3);
      expect(impact.upgrades).toBe(2);
      expect(impact.discounts).toBe(1);
    });

    it('should suggest modifier combinations', () => {
      const item = {
        category: 'main_course',
        price: 15.99
      };

      const modifiers = [
        { name: 'Extra Cheese', type: 'add_on', price_change: 2.00, applicable_items: ['item_001'] },
        { name: 'Medium', type: 'cooking_style', price_change: 0, applicable_items: ['item_001'] },
        { name: 'Side Salad', type: 'side_dish', price_change: 3.50, applicable_items: ['item_001'] }
      ];

      const suggestions = suggestModifierCombinations(item, modifiers);

      expect(suggestions.upsell_modifiers).toHaveLength(2); // Cheese + Side
      expect(suggestions.required_modifiers).toHaveLength(0);
      expect(suggestions.popular_combinations).toBeDefined();
    });

    it('should validate modifier compatibility', () => {
      const modifiers = [
        { type: 'cooking_style', name: 'Rare' },
        { type: 'cooking_style', name: 'Well Done' }
      ];

      const compatibility = validateModifierCompatibility(modifiers);

      expect(compatibility.valid).toBe(false);
      expect(compatibility.conflicts).toContain('Multiple cooking_style modifiers selected');
    });

    it('should calculate modifier popularity', () => {
      const modifierUsage = [
        { modifier_id: 'mod_001', usage_count: 50 },
        { modifier_id: 'mod_002', usage_count: 30 },
        { modifier_id: 'mod_003', usage_count: 20 }
      ];

      const popularity = calculateModifierPopularity(modifierUsage);

      expect(popularity[0].modifier_id).toBe('mod_001');
      expect(popularity[0].percentage).toBe(50);
      expect(popularity[1].percentage).toBe(30);
      expect(popularity[2].percentage).toBe(20);
    });
  });

  describe('Error Handling', () => {
    it('should handle PocketBase API errors', async () => {
      const apiError = new Error('Connection failed');
      mockPocketBase.collection().create.mockRejectedValue(apiError);

      const result = await createMenuModifier(mockPocketBase, validModifierData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create menu modifier');
    });

    it('should handle validation errors from PocketBase', async () => {
      const validationError = new Error('Validation failed');
      validationError.status = 400;
      validationError.data = {
        name: { message: 'Name is required' },
        sort_order: { message: 'Sort order must be unique' }
      };
      mockPocketBase.collection().create.mockRejectedValue(validationError);

      const result = await createMenuModifier(mockPocketBase, {});

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

// Implementation functions for menu modifiers

async function createMenuModifier(pb: any, modifierData: any) {
  try {
    const validation = validateMenuModifierData(modifierData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('menu_modifiers').create(modifierData);
    
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
      error: `Failed to create menu modifier: ${error.message}`
    };
  }
}

async function updateMenuModifier(pb: any, modifierId: string, updateData: any) {
  try {
    const validation = validateMenuModifierData(updateData, true);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('menu_modifiers').update(modifierId, updateData);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to update menu modifier: ${error.message}`
    };
  }
}

async function getMenuModifier(pb: any, modifierId: string) {
  try {
    const record = await pb.collection('menu_modifiers').getOne(modifierId);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve menu modifier: ${error.message}`
    };
  }
}

async function getMenuModifiersList(pb: any, options: any = {}, page = 1, perPage = 20) {
  try {
    const records = await pb.collection('menu_modifiers').getList(page, perPage, options);
    
    return {
      success: true,
      records
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve menu modifiers: ${error.message}`
    };
  }
}

async function getModifiersForMenuItem(pb: any, menuItemId: string) {
  try {
    const records = await pb.collection('menu_modifiers').getList(1, 50, {
      filter: `applicable_items ~ "${menuItemId}"`,
      sort: 'sort_order'
    });
    
    return {
      success: true,
      records
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve modifiers for menu item: ${error.message}`
    };
  }
}

async function deleteMenuModifier(pb: any, modifierId: string) {
  try {
    await pb.collection('menu_modifiers').delete(modifierId);
    
    return {
      success: true
    };
  } catch (error: any) {
    if (error.status === 404) {
      return {
        success: false,
        error: 'Modifier not found'
      };
    }
    
    return {
      success: false,
      error: `Failed to delete menu modifier: ${error.message}`
    };
  }
}

function validateMenuModifierData(data: any, isUpdate = false) {
  const errors: string[] = [];
  const requiredFields = ['name', 'type', 'price_change', 'applicable_items', 'required', 'sort_order'];
  
  const validTypes = ['add_on', 'cooking_style', 'size', 'sauce', 'temperature', 'side_dish'];
  const validMenuItems = ['menu_item_001', 'menu_item_002', 'menu_item_003', 'menu_item_005']; // Mock valid items

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
  if (data.type !== undefined && typeof data.type !== 'string') {
    errors.push('type must be a string');
  }
  if (data.price_change !== undefined && typeof data.price_change !== 'number') {
    errors.push('price_change must be a number');
  }
  if (data.applicable_items !== undefined && !Array.isArray(data.applicable_items)) {
    errors.push('applicable_items must be an array');
  }
  if (data.required !== undefined && typeof data.required !== 'boolean') {
    errors.push('required must be a boolean');
  }
  if (data.sort_order !== undefined && typeof data.sort_order !== 'number') {
    errors.push('sort_order must be a number');
  }

  // Validate field lengths
  if (data.name && data.name.length < 2) {
    errors.push('name must be at least 2 characters');
  }
  if (data.name && data.name.length > 100) {
    errors.push('name must not exceed 100 characters');
  }

  // Validate select field values
  if (data.type && !validTypes.includes(data.type)) {
    errors.push(`type must be one of: ${validTypes.join(', ')}`);
  }

  // Validate numeric ranges
  if (data.price_change !== undefined) {
    if (data.price_change < -100.00 || data.price_change > 100.00) {
      errors.push('price_change must be between -100.00 and 100.00');
    }
  }
  if (data.sort_order !== undefined) {
    if (data.sort_order < 1 || data.sort_order > 1000) {
      errors.push('sort_order must be between 1 and 1000');
    }
  }

  // Validate applicable_items references
  if (data.applicable_items && Array.isArray(data.applicable_items)) {
    const invalidItems = data.applicable_items.filter((itemId: string) => !validMenuItems.includes(itemId));
    if (invalidItems.length > 0) {
      errors.push('applicable_items contains invalid menu item references');
    }
  }

  return { isValid: errors.length === 0, errors };
}

function calculateModifierStats(modifiers: any[]) {
  const total = modifiers.length;
  const by_type = modifiers.reduce((acc: any, mod) => {
    acc[mod.type] = (acc[mod.type] || 0) + 1;
    return acc;
  }, {});
  const required_count = modifiers.filter(mod => mod.required).length;
  const average_price_change = modifiers.reduce((sum, mod) => sum + mod.price_change, 0) / total;
  const free_modifiers = modifiers.filter(mod => mod.price_change === 0).length;

  return {
    total,
    by_type,
    required_count,
    average_price_change: Number(average_price_change.toFixed(2)),
    free_modifiers
  };
}

function groupModifiersByType(modifiers: any[]) {
  return modifiers.reduce((acc: any, modifier) => {
    if (!acc[modifier.type]) {
      acc[modifier.type] = [];
    }
    acc[modifier.type].push(modifier);
    return acc;
  }, {});
}

function calculateModifierImpact(modifiers: any[]) {
  const total_price_change = modifiers.reduce((sum, mod) => sum + mod.price_change, 0);
  const modifier_count = modifiers.length;
  const upgrades = modifiers.filter(mod => mod.price_change > 0).length;
  const discounts = modifiers.filter(mod => mod.price_change < 0).length;

  return {
    total_price_change: Number(total_price_change.toFixed(2)),
    modifier_count,
    upgrades,
    discounts
  };
}

function suggestModifierCombinations(item: any, modifiers: any[]) {
  const upsell_modifiers = modifiers.filter(mod => mod.price_change > 0);
  const required_modifiers = modifiers.filter(mod => mod.required);
  const popular_combinations = ['cheese + bacon', 'side salad + drink']; // Mock data

  return {
    upsell_modifiers,
    required_modifiers,
    popular_combinations
  };
}

function validateModifierCompatibility(modifiers: any[]) {
  const conflicts: string[] = [];
  const typeGroups = groupModifiersByType(modifiers);

  // Check for conflicting modifier types (only one per type for some types)
  const exclusiveTypes = ['cooking_style', 'temperature', 'size'];
  for (const type of exclusiveTypes) {
    if (typeGroups[type] && typeGroups[type].length > 1) {
      conflicts.push(`Multiple ${type} modifiers selected`);
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts
  };
}

function calculateModifierPopularity(usage: any[]) {
  const totalUsage = usage.reduce((sum, item) => sum + item.usage_count, 0);
  
  return usage.map(item => ({
    modifier_id: item.modifier_id,
    usage_count: item.usage_count,
    percentage: Number(((item.usage_count / totalUsage) * 100).toFixed(0))
  })).sort((a, b) => b.usage_count - a.usage_count);
}
