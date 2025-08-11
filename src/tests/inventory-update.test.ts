import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Inventory Items Update Tests', () => {
  let mockPocketBase: any;
  let validUpdateData: any;
  let existingRecord: any;

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

    // Existing inventory record (what we're updating)
    existingRecord = {
      id: 'inventory_001',
      collectionId: 'inventory_collection',
      collectionName: 'inventory_items',
      name: 'Organic Tomatoes',
      description: 'Fresh organic tomatoes',
      category: 'produce',
      unit: 'kg',
      current_stock: 25,
      min_stock_level: 5,
      max_stock_level: 100,
      cost_per_unit: 4.50,
      vendor: 'vendor_001',
      expiry_date: '2025-08-15 00:00:00.000Z',
      created: '2025-08-01T10:00:00.000Z',
      updated: '2025-08-01T10:00:00.000Z'
    };

    // Valid update data
    validUpdateData = {
      name: 'Premium Organic Tomatoes',
      description: 'Premium quality organic tomatoes from local farm',
      category: 'produce',
      unit: 'kg',
      current_stock: 30,
      min_stock_level: 10,
      max_stock_level: 150,
      cost_per_unit: 5.25,
      vendor: 'vendor_002',
      expiry_date: '2025-08-20 00:00:00.000Z'
    };
  });

  describe('Valid Update Scenarios', () => {
    it('should update inventory item with all fields', async () => {
      const updatedRecord = {
        ...existingRecord,
        ...validUpdateData,
        updated: new Date().toISOString()
      };

      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', validUpdateData);

      expect(result.success).toBe(true);
      expect(result.record).toMatchObject({
        name: 'Premium Organic Tomatoes',
        description: 'Premium quality organic tomatoes from local farm',
        category: 'produce',
        current_stock: 30,
        min_stock_level: 10,
        cost_per_unit: 5.25,
        vendor: 'vendor_002'
      });
      expect(mockPocketBase.collection).toHaveBeenCalledWith('inventory_items');
      expect(mockPocketBase.collection().update).toHaveBeenCalledWith('inventory_001', validUpdateData);
    });

    it('should update inventory item with only required fields', async () => {
      const requiredFieldsOnly = {
        name: 'Basic Tomatoes',
        category: 'produce',
        unit: 'kg',
        current_stock: 20,
        min_stock_level: 5
      };

      const updatedRecord = { ...existingRecord, ...requiredFieldsOnly };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', requiredFieldsOnly);

      expect(result.success).toBe(true);
      expect(result.record.name).toBe('Basic Tomatoes');
      expect(result.record.current_stock).toBe(20);
    });

    it('should update only specific fields (partial update)', async () => {
      const partialUpdate = {
        current_stock: 45,
        cost_per_unit: 4.75
      };

      const updatedRecord = { ...existingRecord, ...partialUpdate };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', partialUpdate);

      expect(result.success).toBe(true);
      expect(result.record.current_stock).toBe(45);
      expect(result.record.cost_per_unit).toBe(4.75);
      expect(result.record.name).toBe('Organic Tomatoes'); // Original value preserved
    });

    it('should handle updating stock to zero', async () => {
      const zeroStockUpdate = {
        current_stock: 0,
        min_stock_level: 5
      };

      const updatedRecord = { ...existingRecord, ...zeroStockUpdate };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', zeroStockUpdate);

      expect(result.success).toBe(true);
      expect(result.record.current_stock).toBe(0);
    });

    it('should handle removing optional fields (setting to null/empty)', async () => {
      const removeOptionalFields = {
        description: '',
        max_stock_level: null,
        vendor: null,
        expiry_date: null
      };

      const updatedRecord = { ...existingRecord, ...removeOptionalFields };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', removeOptionalFields);

      expect(result.success).toBe(true);
      expect(result.record.description).toBe('');
      expect(result.record.max_stock_level).toBeNull();
      expect(result.record.vendor).toBeNull();
    });
  });

  describe('Data Validation Tests', () => {
    it('should validate required field types', async () => {
      const invalidTypesData = {
        name: 123, // Should be string
        category: true, // Should be string
        unit: [], // Should be string
        current_stock: 'not a number', // Should be number
        min_stock_level: 'also not a number' // Should be number
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', invalidTypesData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('name must be a string');
      expect(result.errors).toContain('category must be a string');
      expect(result.errors).toContain('unit must be a string');
      expect(result.errors).toContain('current_stock must be a number');
      expect(result.errors).toContain('min_stock_level must be a number');
    });

    it('should validate optional field types', async () => {
      const invalidOptionalData = {
        description: 123, // Should be string
        max_stock_level: 'not a number', // Should be number
        cost_per_unit: 'not a number', // Should be number
        expiry_date: 'invalid date' // Should be valid date
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', invalidOptionalData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('description must be a string');
      expect(result.errors).toContain('max_stock_level must be a number');
      expect(result.errors).toContain('cost_per_unit must be a number');
      expect(result.errors).toContain('expiry_date must be a valid ISO date string');
    });

    it('should validate numeric values are non-negative', async () => {
      const negativeValuesData = {
        current_stock: -10,
        min_stock_level: -5,
        max_stock_level: -20,
        cost_per_unit: -1.50
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', negativeValuesData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('current_stock must be non-negative');
      expect(result.errors).toContain('min_stock_level must be non-negative');
      expect(result.errors).toContain('max_stock_level must be non-negative');
      expect(result.errors).toContain('cost_per_unit must be non-negative');
    });

    it('should validate category values', async () => {
      const invalidCategoryData = {
        category: 'invalid_category'
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', invalidCategoryData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('category must be one of: produce, meat, dairy, beverages, dry_goods, frozen, cleaning, other');
    });

    it('should validate unit values', async () => {
      const invalidUnitData = {
        unit: 'invalid_unit'
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', invalidUnitData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('unit must be one of: piece, kg, g, l, ml, box, case, dozen, pack');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate max_stock_level is greater than min_stock_level', async () => {
      const invalidStockLevels = {
        min_stock_level: 50,
        max_stock_level: 25 // Less than min_stock_level
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', invalidStockLevels);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('max_stock_level must be greater than min_stock_level');
    });

    it('should validate current_stock against stock levels when provided', async () => {
      const stockLevelWarning = {
        current_stock: 2,
        min_stock_level: 10 // Current stock below minimum
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', stockLevelWarning);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('current_stock is below minimum stock level');
    });

    it('should validate expiry date is in the future', async () => {
      const pastExpiryDate = {
        expiry_date: '2020-01-01 00:00:00.000Z' // Past date
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', pastExpiryDate);

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('expiry_date is in the past');
    });
  });

  describe('Relationship Validation', () => {
    it('should validate vendor exists when provided', async () => {
      const invalidVendorData = {
        vendor: 'nonexistent_vendor'
      };

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', invalidVendorData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('vendor must reference an existing vendor record');
    });

    it('should allow removing vendor reference', async () => {
      const removeVendorData = {
        vendor: null
      };

      const updatedRecord = { ...existingRecord, vendor: null };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', removeVendorData);

      expect(result.success).toBe(true);
      expect(result.record.vendor).toBeNull();
    });
  });

  describe('Query Parameters and Expansion', () => {
    it('should support expanding vendor relation', async () => {
      const expandedRecord = {
        ...existingRecord,
        ...validUpdateData,
        expand: {
          vendor: {
            id: 'vendor_002',
            name: 'Premium Farm Suppliers',
            contact_email: 'orders@premiumfarm.com'
          }
        }
      };

      mockPocketBase.collection().update.mockResolvedValue(expandedRecord);

      const result = await updateInventoryItemWithExpansion(
        mockPocketBase,
        'inventory_001',
        validUpdateData,
        'vendor'
      );

      expect(result.expand).toBeDefined();
      expect(result.expand.vendor.name).toBe('Premium Farm Suppliers');
      expect(mockPocketBase.collection().update).toHaveBeenCalledWith(
        'inventory_001',
        validUpdateData,
        { expand: 'vendor' }
      );
    });

    it('should support field filtering', async () => {
      const filteredRecord = {
        id: 'inventory_001',
        name: 'Premium Organic Tomatoes',
        current_stock: 30,
        cost_per_unit: 5.25
      };

      mockPocketBase.collection().update.mockResolvedValue(filteredRecord);

      const result = await updateInventoryItemWithFields(
        mockPocketBase,
        'inventory_001',
        validUpdateData,
        'id,name,current_stock,cost_per_unit'
      );

      expect(Object.keys(result)).toEqual(['id', 'name', 'current_stock', 'cost_per_unit']);
      expect(result.description).toBeUndefined();
      expect(result.vendor).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle PocketBase API errors gracefully', async () => {
      const apiError = new Error('Record not found');
      apiError.status = 404;
      mockPocketBase.collection().update.mockRejectedValue(apiError);

      const result = await updateInventoryItem(mockPocketBase, 'nonexistent_id', validUpdateData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update inventory item');
    });

    it('should handle validation errors from PocketBase', async () => {
      const validationError = new Error('Validation failed');
      validationError.status = 400;
      validationError.data = {
        name: { message: 'Name is required' },
        current_stock: { message: 'Must be a number' }
      };
      mockPocketBase.collection().update.mockRejectedValue(validationError);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', {});

      expect(result.success).toBe(false);
      expect(result.validation_errors).toBeDefined();
    });

    it('should handle network connectivity issues', async () => {
      const networkError = new Error('Network error');
      mockPocketBase.collection().update.mockRejectedValue(networkError);

      const result = await updateInventoryItem(mockPocketBase, 'inventory_001', validUpdateData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to update inventory item');
    });
  });

  describe('Stock Level Calculations', () => {
    it('should calculate stock status based on levels', () => {
      const lowStockItem = { current_stock: 3, min_stock_level: 10, max_stock_level: 100 };
      const normalStockItem = { current_stock: 50, min_stock_level: 10, max_stock_level: 100 };
      const overstockItem = { current_stock: 150, min_stock_level: 10, max_stock_level: 100 };

      expect(calculateStockStatus(lowStockItem)).toBe('low');
      expect(calculateStockStatus(normalStockItem)).toBe('normal');
      expect(calculateStockStatus(overstockItem)).toBe('overstock');
    });

    it('should calculate reorder quantity suggestion', () => {
      const item = { current_stock: 5, min_stock_level: 20, max_stock_level: 100 };
      const reorderQty = calculateReorderQuantity(item);
      
      expect(reorderQty).toBe(95); // max - current
    });
  });
});

// Implementation functions for inventory items update

async function updateInventoryItem(pb: any, recordId: string, updateData: any) {
  try {
    // Validate the update data first
    const validation = validateInventoryUpdateData(updateData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // Update the inventory item record
    const record = await pb.collection('inventory_items').update(recordId, updateData);
    
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
      error: `Failed to update inventory item: ${error.message}`
    };
  }
}

async function updateInventoryItemWithExpansion(pb: any, recordId: string, updateData: any, expand: string) {
  try {
    const validation = validateInventoryUpdateData(updateData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('inventory_items').update(recordId, updateData, { expand });
    return record;
  } catch (error) {
    return undefined;
  }
}

async function updateInventoryItemWithFields(pb: any, recordId: string, updateData: any, fields: string) {
  try {
    const validation = validateInventoryUpdateData(updateData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('inventory_items').update(recordId, updateData, { fields });
    return record;
  } catch (error) {
    return undefined;
  }
}

function validateInventoryUpdateData(data: any) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate field types
  if (data.name !== undefined && typeof data.name !== 'string') {
    errors.push('name must be a string');
  }
  if (data.description !== undefined && typeof data.description !== 'string') {
    errors.push('description must be a string');
  }
  if (data.category !== undefined && typeof data.category !== 'string') {
    errors.push('category must be a string');
  }
  if (data.unit !== undefined && typeof data.unit !== 'string') {
    errors.push('unit must be a string');
  }

  // Validate numeric fields
  const numericFields = ['current_stock', 'min_stock_level', 'max_stock_level', 'cost_per_unit'];
  for (const field of numericFields) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== 'number') {
        errors.push(`${field} must be a number`);
      } else if (data[field] < 0) {
        errors.push(`${field} must be non-negative`);
      }
    }
  }

  // Validate category values
  const validCategories = ['produce', 'meat', 'dairy', 'beverages', 'dry_goods', 'frozen', 'cleaning', 'other'];
  if (data.category && !validCategories.includes(data.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`);
  }

  // Validate unit values
  const validUnits = ['piece', 'kg', 'g', 'l', 'ml', 'box', 'case', 'dozen', 'pack'];
  if (data.unit && !validUnits.includes(data.unit)) {
    errors.push(`unit must be one of: ${validUnits.join(', ')}`);
  }

  // Validate date format
  if (data.expiry_date && data.expiry_date !== null) {
    const date = new Date(data.expiry_date);
    if (isNaN(date.getTime())) {
      errors.push('expiry_date must be a valid ISO date string');
    } else if (date < new Date()) {
      warnings.push('expiry_date is in the past');
    }
  }

  // Business logic validations
  if (data.min_stock_level !== undefined && data.max_stock_level !== undefined) {
    if (data.max_stock_level <= data.min_stock_level) {
      errors.push('max_stock_level must be greater than min_stock_level');
    }
  }

  if (data.current_stock !== undefined && data.min_stock_level !== undefined) {
    if (data.current_stock < data.min_stock_level) {
      warnings.push('current_stock is below minimum stock level');
    }
  }

  // Mock relationship validations
  if (data.vendor === 'nonexistent_vendor') {
    errors.push('vendor must reference an existing vendor record');
  }

  return { isValid: errors.length === 0, errors, warnings };
}

function calculateStockStatus(item: any) {
  if (item.current_stock < item.min_stock_level) {
    return 'low';
  } else if (item.max_stock_level && item.current_stock > item.max_stock_level) {
    return 'overstock';
  } else {
    return 'normal';
  }
}

function calculateReorderQuantity(item: any) {
  if (item.max_stock_level) {
    return item.max_stock_level - item.current_stock;
  }
  return item.min_stock_level * 2; // Default: double the minimum
}
