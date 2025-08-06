# Manual Testing Cleanup Guide

## Quick Clean via PocketBase Admin Panel

Since you have transaction data mixed in, here's the fastest way to get to a clean testing state:

### 🔗 Access Admin Panel
1. Go to: https://pocketbase-production-7050.up.railway.app/_/
2. Login with your admin credentials

### 🗑️ Clear Transaction Data (Keep Seed Data)

**DELETE these collections** (transaction data):
1. **tickets_collection** - All records (active orders)
2. **ticket_items_collection** - All records (order items)  
3. **payments_collection** - All records (payment history)
4. **completed_orders** - All records (order history)

**KEEP these collections** (seed data):
- ✅ **users** - Staff accounts
- ✅ **menu_collection** - Menu items  
- ✅ **tables_collection** - Restaurant tables
- ✅ **staff_collection** - Staff details
- ✅ **sections_collection** - Restaurant sections
- ✅ **inventory_collection** - Inventory items

### 🏢 Reset Table Statuses

In **tables_collection**, for each table:
1. Set `status_field` = `"available"`
2. Clear `notes_field` = `""`

### ⚡ Quick Steps

1. **Admin Panel** → **Collections**
2. **Click `tickets_collection`** → **Records tab** → **Select All** → **Delete**
3. **Click `ticket_items_collection`** → **Records tab** → **Select All** → **Delete**  
4. **Click `payments_collection`** → **Records tab** → **Select All** → **Delete**
5. **Click `completed_orders`** → **Records tab** → **Select All** → **Delete**
6. **Click `tables_collection`** → **Records tab** → **Edit each table**:
   - Set `status_field` to `available`
   - Clear `notes_field`

### ✅ Verification

After cleanup, you should see:
- **0 records** in transaction collections
- **All tables** showing `status_field: "available"`
- **Seed data intact** (menu, staff, etc.)

### 🧪 Ready for Testing

Now you can:
1. **Login as server** 
2. **Select a table**
3. **Add menu items**
4. **Test payment workflows** from clean state
5. **Test manager overrides**
6. **Use Stripe test cards** safely

## Alternative: Automated Cleanup Script

If you prefer automation:

1. **Edit `clean-for-testing.js`**:
   - Add your admin credentials
   - Uncomment the deletion code

2. **Run**: `node clean-for-testing.js`

## Test Data Generation

After cleanup, optionally create test scenarios:

```javascript
// Create 3 test tables with different order states:
// 1. Ready for payment (all items ready)
// 2. Needs manager override (items sent_to_kitchen) 
// 3. Mixed status (some ready, some preparing)
```

## Testing Checklist

After cleanup:
- [ ] All transaction collections empty
- [ ] All tables status = "available"  
- [ ] Menu items still exist
- [ ] Staff accounts work
- [ ] Can create new orders
- [ ] Payment workflow functions
- [ ] Manager override works
- [ ] Stripe test cards process

## Recovery

If something goes wrong:
1. **Check seed data** collections are intact
2. **Re-import menu** if needed from JSON files
3. **Recreate staff accounts** if needed
4. **System should work** with fresh transaction data

---

**📋 This approach gives you a clean slate while preserving all your restaurant setup!**
