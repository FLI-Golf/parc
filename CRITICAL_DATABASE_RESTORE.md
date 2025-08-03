# 🚨 CRITICAL: Database Lost During Scaling

## What Happened
The Fly.io machine scaling operation caused almost ALL collections to be lost. This is a **data loss incident**.

## Immediate Status
❌ **ALL Collections Lost:**
- inventory_collection
- staff_collection  
- shifts_collection (pb_shifts_colle)
- sections_collection
- tables_collection
- vendors_collection
- maintenance_* collections

## URGENT RECOVERY STEPS

### 1. Stop Using App Immediately
The app is now broken and will continue throwing errors until collections are restored.

### 2. Access Admin Panel
https://pocketbase-production-7050.up.railway.app/_/

### 3. Create Collections in This Exact Order

#### Step 1: Core Identity Collections
```bash
# Create these first (no dependencies)
1. vendors_collection_schema.json
2. sections_collection - CREATE MANUALLY:
```

**Manual sections_collection creation:**
```json
{
  "id": "sections_collection", 
  "name": "sections",
  "type": "base",
  "schema": [
    {"id": "section_name", "name": "section_name", "type": "text", "required": true},
    {"id": "section_code", "name": "section_code", "type": "text", "required": true}
  ]
}
```

#### Step 2: Staff & Inventory
```bash
3. staff_collection_schema.json
4. inventory_collection_schema.json
```

#### Step 3: Dependent Collections  
```bash
5. shifts_collection (use create-shifts-collection.json)
6. tables_collection_schema.json
7. menu_collection_schema.json
8. events_collection_schema.json
```

#### Step 4: Support Collections
```bash
9. table_updates_collection_schema.json
10. maintenance_records_schema.json
11. maintenance_tasks_schema.json
12. maintenance_schedules_schema.json
13. maintenance_*_collection_schema.json files
```

### 4. Restore Sample Data
After ALL collections are created:
- Import `shifts_pocketbase_import.json`
- Add sample sections data manually
- Add sample vendors, staff, etc.

### 5. Test Dashboard
Refresh the app - all 404 errors should be gone.

## Data Loss Assessment
⚠️ **Lost Data:**
- All shift schedules
- All staff records  
- All inventory items
- All section definitions
- All vendor information
- All maintenance records

## Prevention Measures
1. **Backup before scaling** - Export all collections first
2. **Verify persistent storage** - Check volume configuration
3. **Test scaling** on non-production data first

## Files Ready for Import
All necessary schema files are in the workspace root:
- vendors_collection_schema.json ✅
- staff_collection_schema.json ✅  
- inventory_collection_schema.json ✅
- events_collection_schema.json ✅
- tables_collection_schema.json ✅
- table_updates_collection_schema.json ✅
- maintenance_*_schema.json ✅
- create-shifts-collection.json ✅

## Estimated Recovery Time
- Schema recreation: 30-45 minutes
- Sample data restoration: 15-30 minutes
- **Total: 45-75 minutes**

This is a **critical incident** requiring immediate action to restore functionality.
