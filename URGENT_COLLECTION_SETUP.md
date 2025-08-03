# URGENT: Collections Lost After Scaling

## What Happened
The machine scaling/restart caused some collections to be lost. This happens when persistent storage isn't properly configured.

## Current Status
❌ **Lost Collections:** inventory_collection, events_collection, table_updates_collection, vendors_collection, sections_collection, maintenance_records*, maintenance_schedules*

✅ **Still Exist:** staff_collection, shifts_collection, menu_collection, tables_collection, maintenance_tasks

## IMMEDIATE ACTION REQUIRED

### 1. Go to Admin Panel
https://pocketbase-production-7050.up.railway.app/_/

### 2. Import These Missing Collections (IN ORDER)

#### Core Collections (Import First)
1. `vendors_collection_schema.json` - **CRITICAL** (fixes vendors 404)
2. `inventory_collection_schema.json` - **CRITICAL** (fixes inventory 404)  
3. `events_collection_schema.json` - **CRITICAL** (fixes events 404)

#### Section Management (Import Second)  
4. Create sections_collection manually:
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

#### Support Collections (Import Third)
5. `table_updates_collection_schema.json`
6. `maintenance_records_schema.json`  
7. `maintenance_schedules_schema.json`
8. `maintenance_tasks_collection_schema.json`
9. `maintenance_records_collection_schema.json`

### 3. Restore Sample Data
After creating collections, import:
- `shifts_pocketbase_import.json` (if shifts data was lost)

## Files Ready in Workspace
All schema files have been generated and are ready to import:
- ✅ vendors_collection_schema.json
- ✅ inventory_collection_schema.json  
- ✅ events_collection_schema.json
- ✅ table_updates_collection_schema.json
- ✅ maintenance_*_schema.json files

## Prevention for Future
After setup, consider:
1. Regular PocketBase backups
2. Verifying persistent volume configuration
3. Testing collection persistence after scaling

## Dashboard Will Work After
Once you import these 9 collections, all 404 errors will be resolved and your dashboard will load properly.
