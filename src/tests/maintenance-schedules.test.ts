import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Maintenance Schedules Tests', () => {
  let mockPocketBase: any;
  let validScheduleData: any;
  let sampleSchedule: any;

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

    // Valid maintenance schedule data
    validScheduleData = {
      task_name: 'Weekly Kitchen Deep Clean',
      status: 'pending',
      notes: 'Deep cleaning of all kitchen equipment, surfaces, and storage areas. Include exhaust system cleaning and filter replacement.'
    };

    // Sample existing schedule
    sampleSchedule = {
      id: 'maintenance_schedule_001',
      collectionId: 'maintenance_schedules_collection',
      collectionName: 'maintenance_schedules',
      ...validScheduleData,
      created: '2025-08-06T10:00:00.000Z',
      updated: '2025-08-06T10:00:00.000Z'
    };
  });

  describe('Create Maintenance Schedule', () => {
    it('should create schedule with valid data', async () => {
      const mockCreatedSchedule = {
        ...sampleSchedule,
        id: 'maintenance_schedule_002',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      };

      mockPocketBase.collection().create.mockResolvedValue(mockCreatedSchedule);

      const result = await createMaintenanceSchedule(mockPocketBase, validScheduleData);

      expect(result.success).toBe(true);
      expect(result.record).toMatchObject({
        task_name: 'Weekly Kitchen Deep Clean',
        status: 'pending',
        notes: expect.any(String)
      });
      expect(mockPocketBase.collection).toHaveBeenCalledWith('maintenance_schedules');
      expect(mockPocketBase.collection().create).toHaveBeenCalledWith(validScheduleData);
    });

    it('should create schedule with different status values', async () => {
      const statusVariations = [
        { status: 'pending', task_name: 'Pending Task' },
        { status: 'in_progress', task_name: 'In Progress Task' },
        { status: 'completed', task_name: 'Completed Task' },
        { status: 'overdue', task_name: 'Overdue Task' },
        { status: 'cancelled', task_name: 'Cancelled Task' }
      ];

      for (const variation of statusVariations) {
        const scheduleData = {
          ...validScheduleData,
          ...variation
        };

        const mockRecord = { ...sampleSchedule, ...variation };
        mockPocketBase.collection().create.mockResolvedValue(mockRecord);

        const result = await createMaintenanceSchedule(mockPocketBase, scheduleData);

        expect(result.success).toBe(true);
        expect(result.record.status).toBe(variation.status);
      }
    });

    it('should create schedule with minimal notes', async () => {
      const minimalData = {
        task_name: 'Quick Safety Check',
        status: 'pending',
        notes: 'Basic safety inspection'
      };

      const mockRecord = { ...sampleSchedule, ...minimalData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMaintenanceSchedule(mockPocketBase, minimalData);

      expect(result.success).toBe(true);
      expect(result.record.notes).toBe('Basic safety inspection');
    });

    it('should create schedule without notes (optional field)', async () => {
      const noNotesData = {
        task_name: 'Daily Equipment Check',
        status: 'pending'
        // notes is optional
      };

      const mockRecord = { ...sampleSchedule, ...noNotesData, notes: null };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMaintenanceSchedule(mockPocketBase, noNotesData);

      expect(result.success).toBe(true);
      expect(result.record.task_name).toBe('Daily Equipment Check');
    });
  });

  describe('Status Field Validation', () => {
    it('should accept all valid status values', async () => {
      const validStatuses = ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'];

      for (const status of validStatuses) {
        const scheduleData = {
          task_name: `Task with ${status} status`,
          status,
          notes: 'Test notes'
        };

        const result = await createMaintenanceSchedule(mockPocketBase, scheduleData);

        // Since we're testing validation, not mock calls, we expect validation to pass
        const validation = validateMaintenanceScheduleData(scheduleData);
        expect(validation.isValid).toBe(true);
      }
    });

    it('should reject invalid status values', async () => {
      const invalidStatusData = {
        task_name: 'Test Task',
        status: 'invalid_status',
        notes: 'Test notes'
      };

      const result = await createMaintenanceSchedule(mockPocketBase, invalidStatusData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('status must be one of: pending, in_progress, completed, overdue, cancelled');
    });

    it('should require status field', async () => {
      const noStatusData = {
        task_name: 'Test Task',
        notes: 'Test notes'
        // Missing status
      };

      const result = await createMaintenanceSchedule(mockPocketBase, noStatusData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('status is required');
    });
  });

  describe('Data Validation', () => {
    it('should reject schedule with missing required fields', async () => {
      const incompleteData = {
        notes: 'Some notes'
        // Missing task_name and status
      };

      const result = await createMaintenanceSchedule(mockPocketBase, incompleteData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('task_name is required');
      expect(result.errors).toContain('status is required');
    });

    it('should validate field types', async () => {
      const invalidTypesData = {
        task_name: 123, // Should be string
        status: [], // Should be string
        notes: true // Should be string
      };

      const result = await createMaintenanceSchedule(mockPocketBase, invalidTypesData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('task_name must be a string');
      expect(result.errors).toContain('status must be a string');
      expect(result.errors).toContain('notes must be a string');
    });

    it('should validate minimum field lengths', async () => {
      const shortFieldsData = {
        task_name: 'AB', // Too short
        status: 'pending',
        notes: 'X' // Too short
      };

      const result = await createMaintenanceSchedule(mockPocketBase, shortFieldsData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('task_name must be at least 3 characters');
      expect(result.errors).toContain('notes must be at least 5 characters');
    });

    it('should validate maximum field lengths', async () => {
      const longFieldsData = {
        task_name: 'A'.repeat(256), // Too long
        status: 'pending',
        notes: 'A'.repeat(3001) // Too long
      };

      const result = await createMaintenanceSchedule(mockPocketBase, longFieldsData);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('task_name must not exceed 255 characters');
      expect(result.errors).toContain('notes must not exceed 3000 characters');
    });

    it('should allow empty notes', async () => {
      const emptyNotesData = {
        task_name: 'Test Task',
        status: 'pending',
        notes: ''
      };

      const mockRecord = { ...sampleSchedule, ...emptyNotesData };
      mockPocketBase.collection().create.mockResolvedValue(mockRecord);

      const result = await createMaintenanceSchedule(mockPocketBase, emptyNotesData);

      expect(result.success).toBe(true);
      expect(result.record.notes).toBe('');
    });
  });

  describe('Update Maintenance Schedule', () => {
    it('should update schedule status', async () => {
      const updateData = {
        status: 'in_progress'
      };

      const updatedRecord = { ...sampleSchedule, ...updateData, updated: new Date().toISOString() };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMaintenanceSchedule(mockPocketBase, 'maintenance_schedule_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.status).toBe('in_progress');
      expect(mockPocketBase.collection().update).toHaveBeenCalledWith('maintenance_schedule_001', updateData);
    });

    it('should update schedule notes', async () => {
      const updateData = {
        notes: 'Updated notes: Equipment inspection completed. Minor issues found and noted for repair.'
      };

      const updatedRecord = { ...sampleSchedule, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMaintenanceSchedule(mockPocketBase, 'maintenance_schedule_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.notes).toContain('Updated notes:');
    });

    it('should update multiple fields', async () => {
      const updateData = {
        status: 'completed',
        notes: 'Task completed successfully. All equipment is functioning properly.'
      };

      const updatedRecord = { ...sampleSchedule, ...updateData };
      mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

      const result = await updateMaintenanceSchedule(mockPocketBase, 'maintenance_schedule_001', updateData);

      expect(result.success).toBe(true);
      expect(result.record.status).toBe('completed');
      expect(result.record.notes).toContain('completed successfully');
    });

    it('should handle status transitions', async () => {
      const transitions = [
        { from: 'pending', to: 'in_progress' },
        { from: 'in_progress', to: 'completed' },
        { from: 'pending', to: 'cancelled' },
        { from: 'in_progress', to: 'overdue' }
      ];

      for (const transition of transitions) {
        const updateData = { status: transition.to };
        const updatedRecord = { ...sampleSchedule, status: transition.to };
        mockPocketBase.collection().update.mockResolvedValue(updatedRecord);

        const result = await updateMaintenanceSchedule(mockPocketBase, 'maintenance_schedule_001', updateData);

        expect(result.success).toBe(true);
        expect(result.record.status).toBe(transition.to);
      }
    });
  });

  describe('Retrieve Maintenance Schedules', () => {
    it('should get schedule by ID', async () => {
      mockPocketBase.collection().getOne.mockResolvedValue(sampleSchedule);

      const result = await getMaintenanceSchedule(mockPocketBase, 'maintenance_schedule_001');

      expect(result.success).toBe(true);
      expect(result.record.id).toBe('maintenance_schedule_001');
      expect(result.record.task_name).toBe('Weekly Kitchen Deep Clean');
    });

    it('should list schedules with status filtering', async () => {
      const schedulesList = {
        items: [
          { ...sampleSchedule, status: 'pending' },
          { ...sampleSchedule, id: 'schedule_002', status: 'pending' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(schedulesList);

      const result = await getMaintenanceSchedulesList(mockPocketBase, {
        filter: 'status = "pending"',
        sort: '-created'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
      expect(result.records.items.every((item: any) => item.status === 'pending')).toBe(true);
    });

    it('should list overdue schedules', async () => {
      const overdueSchedules = {
        items: [
          { ...sampleSchedule, status: 'overdue', task_name: 'Overdue Task 1' },
          { ...sampleSchedule, id: 'schedule_003', status: 'overdue', task_name: 'Overdue Task 2' }
        ],
        page: 1,
        perPage: 20,
        totalItems: 2,
        totalPages: 1
      };

      mockPocketBase.collection().getList.mockResolvedValue(overdueSchedules);

      const result = await getMaintenanceSchedulesList(mockPocketBase, {
        filter: 'status = "overdue"'
      });

      expect(result.success).toBe(true);
      expect(result.records.items).toHaveLength(2);
      expect(result.records.items.every((item: any) => item.status === 'overdue')).toBe(true);
    });

    it('should get schedules with pagination', async () => {
      const paginatedSchedules = {
        items: [sampleSchedule],
        page: 2,
        perPage: 10,
        totalItems: 25,
        totalPages: 3
      };

      mockPocketBase.collection().getList.mockResolvedValue(paginatedSchedules);

      const result = await getMaintenanceSchedulesList(mockPocketBase, {}, 2, 10);

      expect(result.success).toBe(true);
      expect(result.records.page).toBe(2);
      expect(result.records.perPage).toBe(10);
      expect(result.records.totalItems).toBe(25);
    });
  });

  describe('Delete Maintenance Schedule', () => {
    it('should delete schedule successfully', async () => {
      mockPocketBase.collection().delete.mockResolvedValue(true);

      const result = await deleteMaintenanceSchedule(mockPocketBase, 'maintenance_schedule_001');

      expect(result.success).toBe(true);
      expect(mockPocketBase.collection().delete).toHaveBeenCalledWith('maintenance_schedule_001');
    });

    it('should handle delete of non-existent schedule', async () => {
      const notFoundError = new Error('Schedule not found');
      notFoundError.status = 404;
      mockPocketBase.collection().delete.mockRejectedValue(notFoundError);

      const result = await deleteMaintenanceSchedule(mockPocketBase, 'nonexistent_schedule');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Schedule not found');
    });

    it('should prevent deletion of in-progress schedules', async () => {
      const result = await deleteMaintenanceSchedule(mockPocketBase, 'maintenance_schedule_001', 'in_progress');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot delete schedule with status: in_progress');
    });
  });

  describe('Business Logic', () => {
    it('should calculate schedule statistics by status', () => {
      const schedules = [
        { status: 'pending' },
        { status: 'pending' },
        { status: 'in_progress' },
        { status: 'completed' },
        { status: 'overdue' }
      ];

      const stats = calculateScheduleStats(schedules);

      expect(stats.total).toBe(5);
      expect(stats.by_status.pending).toBe(2);
      expect(stats.by_status.in_progress).toBe(1);
      expect(stats.by_status.completed).toBe(1);
      expect(stats.by_status.overdue).toBe(1);
      expect(stats.completion_rate).toBe(20); // 1/5 = 20%
    });

    it('should identify high-priority overdue tasks', () => {
      const schedules = [
        { status: 'overdue', task_name: 'Critical Safety Check' },
        { status: 'overdue', task_name: 'Daily Cleaning' },
        { status: 'pending', task_name: 'Monthly Inspection' },
        { status: 'overdue', task_name: 'Emergency Equipment Test' }
      ];

      const overdueTasks = getOverdueTasks(schedules);

      expect(overdueTasks).toHaveLength(3);
      expect(overdueTasks.every(task => task.status === 'overdue')).toBe(true);
    });

    it('should suggest next actions based on status', () => {
      expect(getNextAction('pending')).toBe('Start the task');
      expect(getNextAction('in_progress')).toBe('Continue working on the task');
      expect(getNextAction('completed')).toBe('Task is complete');
      expect(getNextAction('overdue')).toBe('Urgent: Complete this overdue task');
      expect(getNextAction('cancelled')).toBe('Task was cancelled');
    });
  });

  describe('Error Handling', () => {
    it('should handle PocketBase API errors', async () => {
      const apiError = new Error('Connection failed');
      mockPocketBase.collection().create.mockRejectedValue(apiError);

      const result = await createMaintenanceSchedule(mockPocketBase, validScheduleData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create maintenance schedule');
    });

    it('should handle validation errors from PocketBase', async () => {
      const validationError = new Error('Validation failed');
      validationError.status = 400;
      validationError.data = {
        task_name: { message: 'Task name is required' },
        status: { message: 'Invalid status value' }
      };
      mockPocketBase.collection().create.mockRejectedValue(validationError);

      const result = await createMaintenanceSchedule(mockPocketBase, {});

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});

// Implementation functions for maintenance schedules

async function createMaintenanceSchedule(pb: any, scheduleData: any) {
  try {
    const validation = validateMaintenanceScheduleData(scheduleData);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('maintenance_schedules').create(scheduleData);
    
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
      error: `Failed to create maintenance schedule: ${error.message}`
    };
  }
}

async function updateMaintenanceSchedule(pb: any, scheduleId: string, updateData: any) {
  try {
    const validation = validateMaintenanceScheduleData(updateData, true);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const record = await pb.collection('maintenance_schedules').update(scheduleId, updateData);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to update maintenance schedule: ${error.message}`
    };
  }
}

async function getMaintenanceSchedule(pb: any, scheduleId: string) {
  try {
    const record = await pb.collection('maintenance_schedules').getOne(scheduleId);
    
    return {
      success: true,
      record
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve maintenance schedule: ${error.message}`
    };
  }
}

async function getMaintenanceSchedulesList(pb: any, options: any = {}, page = 1, perPage = 20) {
  try {
    const records = await pb.collection('maintenance_schedules').getList(page, perPage, options);
    
    return {
      success: true,
      records
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to retrieve maintenance schedules: ${error.message}`
    };
  }
}

async function deleteMaintenanceSchedule(pb: any, scheduleId: string, currentStatus?: string) {
  try {
    // Business rule: prevent deletion of in-progress schedules
    if (currentStatus === 'in_progress') {
      return {
        success: false,
        error: 'Cannot delete schedule with status: in_progress'
      };
    }

    await pb.collection('maintenance_schedules').delete(scheduleId);
    
    return {
      success: true
    };
  } catch (error: any) {
    if (error.status === 404) {
      return {
        success: false,
        error: 'Schedule not found'
      };
    }
    
    return {
      success: false,
      error: `Failed to delete maintenance schedule: ${error.message}`
    };
  }
}

function validateMaintenanceScheduleData(data: any, isUpdate = false) {
  const errors: string[] = [];
  const requiredFields = ['task_name', 'status'];
  const validStatuses = ['pending', 'in_progress', 'completed', 'overdue', 'cancelled'];

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
  if (data.status !== undefined && typeof data.status !== 'string') {
    errors.push('status must be a string');
  }
  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    errors.push('notes must be a string');
  }

  // Validate field lengths
  if (data.task_name && data.task_name.length < 3) {
    errors.push('task_name must be at least 3 characters');
  }
  if (data.task_name && data.task_name.length > 255) {
    errors.push('task_name must not exceed 255 characters');
  }
  if (data.notes && data.notes.length > 0 && data.notes.length < 5) {
    errors.push('notes must be at least 5 characters');
  }
  if (data.notes && data.notes.length > 3000) {
    errors.push('notes must not exceed 3000 characters');
  }

  // Validate status values
  if (data.status && !validStatuses.includes(data.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }

  return { isValid: errors.length === 0, errors };
}

function calculateScheduleStats(schedules: any[]) {
  const total = schedules.length;
  const by_status = schedules.reduce((acc: any, schedule) => {
    acc[schedule.status] = (acc[schedule.status] || 0) + 1;
    return acc;
  }, {});
  
  const completed = by_status.completed || 0;
  const completion_rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    by_status,
    completion_rate
  };
}

function getOverdueTasks(schedules: any[]) {
  return schedules.filter(schedule => schedule.status === 'overdue');
}

function getNextAction(status: string): string {
  const actions: { [key: string]: string } = {
    pending: 'Start the task',
    in_progress: 'Continue working on the task',
    completed: 'Task is complete',
    overdue: 'Urgent: Complete this overdue task',
    cancelled: 'Task was cancelled'
  };
  
  return actions[status] || 'Unknown status';
}
