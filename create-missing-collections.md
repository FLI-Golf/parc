# Missing Collections Setup

## Issue
The `shifts_collection` doesn't exist in your PocketBase instance, causing 404 errors when the app tries to fetch shifts data.

## Solution
You need to create the missing collection using the PocketBase admin panel.

### Steps:

1. **Access PocketBase Admin Panel**
   - Go to: https://pocketbase-production-7050.up.railway.app/_/
   - You'll need to create an admin account if one doesn't exist

2. **Create New Collection**
   - Click "New collection"
   - Use collection ID: `shifts_collection`
   - Use collection name: `shifts`
   - Import the schema from `create-shifts-collection.json`

3. **Alternative: Use API/Script**
   If you have admin access, you can use a script to create it automatically.

### Collection Schema Required:
The `shifts_collection` needs these fields:
- `staff_member` (relation to staff_collection)
- `shift_date` (date)
- `start_time` (text, HH:MM format)  
- `end_time` (text, HH:MM format)
- `break_duration` (number, minutes)
- `position` (select: Server, Bartender, Host, etc.)
- `status` (select: Scheduled, In Progress, Completed, etc.)
- `notes` (text, optional)
- `assigned_section` (relation to sections_collection, optional)

### Quick Fix:
If you don't want to create the collection right now, you can comment out the shifts loading in the dashboard to stop the error:

In `src/routes/dashboard/manager/+page.svelte`, comment out the shifts loading:
```javascript
// collections.getShifts(),  // Comment this line
```
