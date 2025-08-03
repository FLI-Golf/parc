# PARC Portal Setup Instructions

## Current Status
✅ Sections collection exists  
❌ Multiple collections missing causing 404 errors

## Quick Fix Applied
- Added error handling to prevent dashboard crashes
- App now loads but missing features until collections are created

## Required Setup Steps

### 1. Access PocketBase Admin
Go to: **https://pocketbase-production-7050.up.railway.app/_/**

### 2. Create Collections
Import these schema files in order:

#### Core Collections (Required)
1. `staff_collection_schema.json` - Staff management
2. `inventory_collection_schema.json` - Inventory tracking  
3. `menu_collection_schema.json` - Menu items
4. `events_collection_schema.json` - Event scheduling
5. `tables_collection_schema.json` - Table management

#### Maintenance Collections (Optional)
6. `maintenance_schedules_schema.json`
7. `maintenance_tasks_schema.json` 
8. `maintenance_records_schema.json`
9. `maintenance_tasks_collection_schema.json`
10. `maintenance_records_collection_schema.json`

#### Shifts Collection
11. `create-shifts-collection.json` - Shift scheduling

### 3. Import Sample Data
After creating collections, import:
- `shifts_pocketbase_import.json` - Sample shift data

### 4. Verify Setup
Once complete, refresh the dashboard. All 404 errors should be resolved.

## Collection Dependencies
```
staff_collection → user_id (relates to _pb_users_auth_)
shifts_collection → staff_member (relates to staff_collection)
shifts_collection → assigned_section (relates to sections_collection)
inventory_collection → vendor_field (relates to vendors_collection)
tables_collection → section_field (relates to sections_collection)
```

## Current Collections Status
- ✅ sections_collection (15 sections loaded)
- ✅ vendors_collection (working)
- ❌ inventory_collection (404 error)
- ❌ staff_collection (404 error) 
- ❌ menu_collection (404 error)
- ❌ events_collection (404 error)
- ❌ tables_collection (404 error)
- ❌ shifts_collection (likely missing)
- ❌ maintenance_* collections (404 errors)

## Files Generated
All necessary schema and data files have been created in the workspace root.
