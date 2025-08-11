import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Maintenance Tasks Tests', () => {
  let mockPocketBase: any;
  let validTaskData: any;
  let sampleTask: any;

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

    // Valid maintenance task data
    validTaskData = {
      task_name: 'Deep Clean Commercial Oven',
      description: 'Comprehensive cleaning of commercial oven including interior, racks, and ventilation system. Check heating elements and gas connections.',
      category: 'kitchen',
      frequency: 'monthly',
      priority: 'high',
      estimated_duration: 120, // minutes
      status: 'active'
    };

    // Sample existing task
    sampleTask = {
      id: 'maintenance_task_001',
      collectionId: 'maintenance_tasks_collection',
      collectionName: 'maintenance_tasks',
      ...validTaskData,
      created: '2025-08-06T10:00:00.000Z',
      updated: '2025-08-06T10:00:00.000Z'
    };
  });

  describe('Create Maintenance Task', () => {
    it('should create task with valid data', async () => {
      const mockCreatedTask = {
        ...sampleTask,
        id: 'maintenance_task_002',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      mockPocketBase.collection().create.mockResolvedValue(mockCreatedTask);

      const result = await createMaintenanceTask(mockPocketBase, validTaskData);

      expect(result.success).toBe(true);
      expect(result.record).toMatchObject({
        task_name: 'Deep Clean Commercial Oven',
        category: 'kitchen',
        frequency: 'monthly',
        priority: 'high',
        status: 'active'
      });
      expect(mockPocketBase.collection).toHaveBeenCalledWith('maintenance_tasks');
      expect(mockPocketBase.collection().create).toHaveBeenCalledWith(validTaskData);
    });

    it('should create tasks with different categories', async () => {
      const categories = [
        'kitchen', 'equipment', 'cleaning', 'safety', 'hvac', 
        'plumbing', 'electrical', 'pest_control', 'fire_safety', 'general'
      ];

      for (const category of categories) {
        const taskData = {
          ...validTaskData,
          task_name: `${category} maintenance task`,
          category
        };

        const mockRecord = { ...sampleTask, ...taskData };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMaintenanceTask(mockPocketBase, taskData);

        expect(result.success).toBe(true);
        expect(result.record.category).toBe(category);
      }
    });

    it('should create tasks with different frequencies', async () => {
      const frequencies = [
        'daily', 'weekly', 'bi_weekly', 'monthly', 
        'quarterly', 'bi_annually', 'yearly', 'as_needed'
      ];

      for (const frequency of frequencies) {
        const taskData = {
          ...validTaskData,
          task_name: `${frequency} maintenance task`,
          frequency
        };

        const mockRecord = { ...sampleTask, ...taskData };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMaintenanceTask(mockPocketBase, taskData);

        expect(result.success).toBe(true);
        expect(result.record.frequency).toBe(frequency);
      }
    });

    it('should create tasks with different priorities', async () => {
      const priorities = ['low', 'medium', 'high', 'critical'];

      for (const priority of priorities) {
        const taskData = {
          ...validTaskData,
          task_name: `${priority} priority task`,
          priority
        };

        const mockRecord = { ...sampleTask, ...taskData };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMaintenanceTask(mockPocketBase, taskData);

        expect(result.success).toBe(true);
        expect(result.record.priority).toBe(priority);
      }
    });

    it('should create tasks with different statuses', async () => {
      const statuses = ['active', 'inactive', 'suspended', 'pending'];

      for (const status of statuses) {
        const taskData = {
          ...validTaskData,
          task_name: `${status} status task`,
          status
        };

        const mockRecord = { ...sampleTask, ...taskData };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMaintenanceTask(mockPocketBase, taskData);

        expect(result.success).toBe(true);
        expect(result.record.status).toBe(status);
      }
    });

    it('should create task without description (optional field)', async () => {
      const noDescriptionData = {
        task_name: 'Quick Equipment Check',
        category: 'equipment',
        frequency: 'daily',
        priority: 'medium',
        estimated_duration: 15,
        status: 'active'
        // description is optional
      };

      const mockRecord = { ...sampleTask, ...noDescriptionData, description: null };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMaintenanceTask(mockPocketBase, noDescriptionData);

      expect(result.success).toBe(true);
      expect(result.record.task_name).toBe('Quick Equipment Check');
    });
  });

  describe('Field Validation', () => {
    it('should reject task with missing required fields', async () => {
      const incompleteData = {
        task_name: 'Test Task'
        // Missing category, frequency, priority, status
      };

      const result = await createMaintenanceTask(mockPocketBase, incompleteData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('category is required');
      expect(result.errors).toContain('frequency is required');
      expect(result.errors).toContain('priority is required');
      expect(result.errors).toContain('status is required');
    });

    it('should validate field types', async () => {
      const invalidTypesData = {
        task_name: 123, // Should be string
        description: [], // Should be string
        category: true, // Should be string
        frequency: {}, // Should be string
        priority: 456, // Should be string
        estimated_duration: 'not a number', // Should be number
        status: null // Should be string
      };

      const result = await createMaintenanceTask(mockPocketBase, invalidTypesData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('task_name must be a string');
      expect(result.errors).toContain('description must be a string');
      expect(result.errors).toContain('category must be a string');
      expect(result.errors).toContain('frequency must be a string');
      expect(result.errors).toContain('priority must be a string');
      expect(result.errors).toContain('estimated_duration must be a number');
      expect(result.errors).toContain('status must be a string');
    });

    it('should validate select field values', async () => {
      const invalidSelectData = {
        task_name: 'Test Task',
        description: 'Test description',
        category: 'invalid_category',
        frequency: 'invalid_frequency',
        priority: 'invalid_priority',
        estimated_duration: 60,
        status: 'invalid_status'
      };

      const result = await createMaintenanceTask(mockPocketBase, invalidSelectData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('category must be one of: kitchen, equipment, cleaning, safety, hvac, plumbing, electrical, pest_control, fire_safety, general');
      expect(result.errors).toContain('frequency must be one of: daily, weekly, bi_weekly, monthly, quarterly, bi_annually, yearly, as_needed');
      expect(result.errors).toContain('priority must be one of: low, medium, high, critical');
      expect(result.errors).toContain('status must be one of: active, inactive, suspended, pending');
    });

    it('should validate field lengths', async () => {
      const invalidLengthData = {
        task_name: 'AB', // Too short
        description: 'X'.repeat(2001), // Too long
        category: 'kitchen',
        frequency: 'monthly',
        priority: 'medium',
        estimated_duration: 60,
        status: 'active'
      };

      const result = await createMaintenanceTask(mockPocketBase, invalidLengthData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('task_name must be at least 3 characters');
      expect(result.errors).toContain('description must not exceed 2000 characters');
    });

    it('should validate estimated_duration range', async () => {
      const invalidDurationData = [
        { estimated_duration: -5 }, // Negative
        { estimated_duration: 0 }, // Zero
        { estimated_duration: 1441 } // Over 24 hours (1440 minutes)
      ];

      for (const data of invalidDurationData) {
        const taskData = { ...validTaskData, ...data };
        const result = await createMaintenanceTask(mockPocketBase, taskData);

        expect(result.success).toBe(false);
        expect(result.errors).toContain('estimated_duration must be between 1 and 1440 minutes');
      }
    });

    it('should accept valid estimated_duration values', async () => {
      const validDurations = [1, 30, 60, 120, 480, 1440]; // 1 min to 24 hours

      for (const duration of validDurations) {
        const taskData = { ...validTaskData, estimated_duration: duration };
        const mockRecord = { ...sampleTask, estimated_duration: duration };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMaintenanceTask(mockPocketBase, taskData);

        expect(result.success).toBe(true);
        expect(result.record.estimated_duration).toBe(duration);
      }
    });
  });

  describe('Update Maintenance Task', () => {
    it('should update task status', async () => {
      const updateData = {
        status: 'suspended'
      };

      const updatedRecord = { ...sampleTask, ...updateData, updated: new Date().toISOString() };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMaintenanceTask(mockPocketBase, 'maintenance_task_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.status).toBe('suspended');
      expect(mockPocketBase.collection().update).toHaveBeenCalledWith('maintenance_task_001', updateData);
    });

    it('should update task priority', async () => {
      const updateData = {
        priority: 'critical'
      };

      const updatedRecord = { ...sampleTask, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMaintenanceTask(mockPocketBase, 'maintenance_task_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.priority).toBe('critical');
    });

    it('should update multiple fields', async () => {
      const updateData = {
        priority: 'critical',
        status: 'active',
        estimated_duration: 180,
        description: 'Updated: Critical maintenance task requiring immediate attention'
      };

      const updatedRecord = { ...sampleTask, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMaintenanceTask(mockPocketBase, 'maintenance_task_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.priority).toBe('critical');
      expect(result.record.estimated_duration).toBe(180);
      expect(result.record.description).toContain('Updated:');
    });
  });

  describe('Retrieve Maintenance Tasks', () => {
    it('should get task by ID', async () => {
      mockPocketBase.collection().getOne.mockResolvedValue(sampleTask);

      const result = await getMaintenanceTask(mockPocketBase, 'maintenance_task_001');

      expect(result.success).toBe(true);
      expect(result.record.id).toBe('maintenance_task_001');
      expect(result.record.task_name).toBe('Deep Clean Commercial Oven');
    });

    it('should list tasks with category filtering', async () => {
      const tasksList = {
        items: [
          { ...sampleTask, category: 'kitchen' },
          { ...sampleTask, id: 'task_002', category: 'kitchen', task_name: 'Clean Fryer' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(tasksList);

      const result = await getMaintenanceTasksList(mockPocketBase, {
        filter: 'category = "kitchen"',
        sort: 'priority'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
      expect(result.records.items.every((item: any) => item.category === 'kitchen')).toBe(true);
    });

    it('should list tasks by priority', async () => {
      const highPriorityTasks = {
        items: [
          { ...sampleTask, priority: 'critical' },
          { ...sampleTask, id: 'task_003', priority: 'high' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(highPriorityTasks);

      const result = await getMaintenanceTasksList(mockPocketBase, {
        filter: 'priority = "critical" || priority = "high"',
        sort: '-priority'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
    });

    it('should list active tasks only', async () => {
      const activeTasks = {
        items: [
          { ...sampleTask, status: 'active' },
          { ...sampleTask, id: 'task_004', status: 'active' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(activeTasks);

      const result = await getMaintenanceTasksList(mockPocketBase, {
        filter: 'status = "active"'
      });

      expect(result.success).toBe(true);
      expect(result.records.items.every((item: any) => item.status === 'active')).toBe(true);
    });
  });

  describe('Delete Maintenance Task', () => {
    it('should delete task successfully', async () => {
      mockPocketBase.collection().delete.mockResolvedValue(true);

      const result = await deleteMaintenanceTask(mockPocketBase, 'maintenance_task_001');

      expect(result.success).toBe(true);
      expect(mockPocketBase.collection().delete).toHaveBeenCalledWith('maintenance_task_001');
    });

    it('should handle delete of non-existent task', async () => {
      const notFoundError = new Error('Task not found');
      notFoundError.status = 404;
      mockPocketBase.collection().delete.mockRejectedValue(notFoundError);

      const result = await deleteMaintenanceTask(mockPocketBase, 'nonexistent_task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task not found');
    });
  });

  describe('Business Logic and Analytics', () => {
    it('should calculate task statistics by category', () => {
      const tasks = [
        { category: 'kitchen', priority: 'high' },
        { category: 'kitchen', priority: 'medium' },
        { category: 'equipment', priority: 'critical' },
        { category: 'safety', priority: 'high' },
        { category: 'kitchen', priority: 'low' }
      ];

      const stats = calculateTaskStatsByCategory(tasks);

      expect(stats.kitchen.total).toBe(3);
      expect(stats.equipment.total).toBe(1);
      expect(stats.safety.total).toBe(1);
      expect(stats.kitchen.high_priority).toBe(1);
    });

    it('should calculate workload by estimated duration', () => {
      const tasks = [
        { estimated_duration: 30, status: 'active' },
        { estimated_duration: 60, status: 'active' },
        { estimated_duration: 120, status: 'suspended' },
        { estimated_duration: 45, status: 'active' }
      ];

      const workload = calculateWorkload(tasks);

      expect(workload.total_active_minutes).toBe(135); // 30 + 60 + 45
      expect(workload.total_active_hours).toBe(2.25);
      expect(workload.active_task_count).toBe(3);
    });

    it('should suggest maintenance schedule based on frequency', () => {
      const task = { 
        frequency: 'weekly', 
        task_name: 'Clean Equipment',
        last_completed: '2025-08-01T10:00:00.000Z'
      };

      const nextDate = calculateNextMaintenanceDate(task);
      const expected = new Date('2025-08-08T10:00:00.000Z');

      expect(nextDate.getTime()).toBe(expected.getTime());
    });

    it('should prioritize tasks by urgency and importance', () => {
      const tasks = [
        { priority: 'low', frequency: 'daily', category: 'cleaning' },
        { priority: 'critical', frequency: 'monthly', category: 'safety' },
        { priority: 'high', frequency: 'weekly', category: 'equipment' },
        { priority: 'medium', frequency: 'daily', category: 'kitchen' }
      ];

      const prioritized = prioritizeTasks(tasks);

      expect(prioritized[0].priority).toBe('critical');
      expect(prioritized[1].priority).toBe('high');
    });

    it('should group tasks by estimated time slots', () => {
      const tasks = [
        { estimated_duration: 15, task_name: 'Quick check' },
        { estimated_duration: 45, task_name: 'Medium task' },
        { estimated_duration: 120, task_name: 'Long maintenance' },
        { estimated_duration: 30, task_name: 'Short task' }
      ];

      const grouped = groupTasksByTimeSlot(tasks);

      expect(grouped.short).toHaveLength(2); // 15, 30 minutes
      expect(grouped.medium).toHaveLength(1); // 45 minutes
      expect(grouped.long).toHaveLength(1); // 120 minutes
    });
  });

  describe('Error Handling', () => {
    it('should handle PocketBase API errors', async () => {
      const apiError = new Error('Connection failed');
      mockPocketBase.collection().create.mockRejectedValue(apiError);

      const result = await createMaintenanceTask(mockPocketBase, validTaskData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create maintenance task');
    });

    it('should handle validation errors from PocketBase', async () => {
      const validationError = new Error('Validation failed');
      validationError.status = 400;
      validationError.data = {
        task_name: { message: 'Task name is required' },
        category: { message: 'Invalid category' }
      };
      mockPocketBase.collection().create.mockRejectedValue(validationError);

      const result = await createMaintenanceTask(mockPocketBase, {});

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

// Implementation functions for maintenance tasks

async function createMaintenanceTask(pb: any, taskData: any) {
  try {
    const validation = validateMaintenanceTaskData(taskData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('maintenance_tasks').create(taskData);
    
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
      error: `Failed to create maintenance task: ${error.message}`
    };
  }
}

async function updateMaintenanceTask(pb: any, taskId: string, updateData: any) {
  try {
    const validation = validateMaintenanceTaskData(updateData, true);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('maintenance_tasks').update(taskId, updateData);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to update maintenance task: ${error.message}`
    };
  }
}

async function getMaintenanceTask(pb: any, taskId: string) {
  try {
    const record = await pb.collection('maintenance_tasks').getOne(taskId);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve maintenance task: ${error.message}`
    };
  }
}

async function getMaintenanceTasksList(pb: any, options: any = {}, page = 1, perPage = 20) {
  try {
    const records = await pb.collection('maintenance_tasks').getList(page, perPage, options);
    
    return {
      success: true,
      records
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve maintenance tasks: ${error.message}`
    };
  }
}

async function deleteMaintenanceTask(pb: any, taskId: string) {
  try {
    await pb.collection('maintenance_tasks').delete(taskId);
    
    return {
      success: true
    };
  } catch (error: any) {
    if (error.status === 404) {
      return {
        success: false,
        error: 'Task not found'
      };
    }
    
    return {
      success: false,
      error: `Failed to delete maintenance task: ${error.message}`
    };
  }
}

function validateMaintenanceTaskData(data: any, isUpdate = false) {
  const errors: string[] = [];
  const requiredFields = ['task_name', 'category', 'frequency', 'priority', 'status'];
  
  const validCategories = ['kitchen', 'equipment', 'cleaning', 'safety', 'hvac', 'plumbing', 'electrical', 'pest_control', 'fire_safety', 'general'];
  const validFrequencies = ['daily', 'weekly', 'bi_weekly', 'monthly', 'quarterly', 'bi_annually', 'yearly', 'as_needed'];
  const validPriorities = ['low', 'medium', 'high', 'critical'];
  const validStatuses = ['active', 'inactive', 'suspended', 'pending'];

  // Check required fields (only for creation, not updates)
  if (!isUpdate) {
    for (const field of requiredFields) {
      if (!data[field] || data[field].toString().trim() === '') {
        errors.push(`${field} is required`);
      }
    }
  }

  // Validate field types
  if (data.task_name !== undefined && typeof data.task_name !== 'string') {
    errors.push('task_name must be a string');
  }
  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    errors.push('description must be a string');
  }
  if (data.category !== undefined && typeof data.category !== 'string') {
    errors.push('category must be a string');
  }
  if (data.frequency !== undefined && typeof data.frequency !== 'string') {
    errors.push('frequency must be a string');
  }
  if (data.priority !== undefined && typeof data.priority !== 'string') {
    errors.push('priority must be a string');
  }
  if (data.estimated_duration !== undefined && typeof data.estimated_duration !== 'number') {
    errors.push('estimated_duration must be a number');
  }
  if (data.status !== undefined && typeof data.status !== 'string') {
    errors.push('status must be a string');
  }

  // Validate field lengths
  if (data.task_name && data.task_name.length < 3) {
    errors.push('task_name must be at least 3 characters');
  }
  if (data.task_name && data.task_name.length > 255) {
    errors.push('task_name must not exceed 255 characters');
  }
  if (data.description && data.description.length > 2000) {
    errors.push('description must not exceed 2000 characters');
  }

  // Validate select field values
  if (data.category && !validCategories.includes(data.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`);
  }
  if (data.frequency && !validFrequencies.includes(data.frequency)) {
    errors.push(`frequency must be one of: ${validFrequencies.join(', ')}`);
  }
  if (data.priority && !validPriorities.includes(data.priority)) {
    errors.push(`priority must be one of: ${validPriorities.join(', ')}`);
  }
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate estimated_duration range
  if (data.estimated_duration !== undefined) {
    if (data.estimated_duration < 1 || data.estimated_duration > 1440) {
      errors.push('estimated_duration must be between 1 and 1440 minutes');
    }
  }

  return { isValid: errors.length === 0, errors };
}

function calculateTaskStatsByCategory(tasks: any[]) {
  const stats: any = {};
  
  tasks.forEach(task => {
    if (!stats[task.category]) {
      stats[task.category] = { total: 0, high_priority: 0, critical_priority: 0 };
    }
    stats[task.category].total++;
    if (task.priority === 'high') stats[task.category].high_priority++;
    if (task.priority === 'critical') stats[task.category].critical_priority++;
  });

  return stats;
}

function calculateWorkload(tasks: any[]) {
  const activeTasks = tasks.filter(task => task.status === 'active');
  const total_active_minutes = activeTasks.reduce((sum, task) => sum + task.estimated_duration, 0);
  const total_active_hours = Number((total_active_minutes / 60).toFixed(2));
  const active_task_count = activeTasks.length;

  return {
    total_active_minutes,
    total_active_hours,
    active_task_count
  };
}

function calculateNextMaintenanceDate(task: any) {
  const lastCompleted = new Date(task.last_completed);
  const frequencyDays: { [key: string]: number } = {
    daily: 1,
    weekly: 7,
    bi_weekly: 14,
    monthly: 30,
    quarterly: 90,
    bi_annually: 180,
    yearly: 365,
    as_needed: 0
  };

  const days = frequencyDays[task.frequency] || 0;
  const nextDate = new Date(lastCompleted);
  nextDate.setDate(nextDate.getDate() + days);
  
  return nextDate;
}

function prioritizeTasks(tasks: any[]) {
  const priorityOrder: { [key: string]: number } = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  return tasks.sort((a, b) => {
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // If same priority, sort by frequency (daily tasks first)
    const frequencyOrder: { [key: string]: number } = {
      daily: 7,
      weekly: 6,
      bi_weekly: 5,
      monthly: 4,
      quarterly: 3,
      bi_annually: 2,
      yearly: 1,
      as_needed: 0
    };
    
    return frequencyOrder[b.frequency] - frequencyOrder[a.frequency];
  });
}

function groupTasksByTimeSlot(tasks: any[]) {
  const groups = {
    short: [] as any[], // <= 30 minutes
    medium: [] as any[], // 31-60 minutes
    long: [] as any[] // > 60 minutes
  };

  tasks.forEach(task => {
    if (task.estimated_duration <= 30) {
      groups.short.push(task);
    } else if (task.estimated_duration <= 60) {
      groups.medium.push(task);
    } else {
      groups.long.push(task);
    }
  });

  return groups;
}
