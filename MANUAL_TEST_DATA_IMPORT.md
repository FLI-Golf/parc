# Manual Test Data Import Guide

To test the table status system, you need to manually import some test orders into your PocketBase database.

## Step 1: Access PocketBase Admin

1. Go to your PocketBase admin panel: `https://pocketbase-production-7050.up.railway.app/_/`
2. Login with your admin credentials

## Step 2: Import Test Tickets

Go to the `tickets` collection and create these records manually:

### Ticket 1 (Orange Dot - Cooking)
```
ticket_number: T001
table_id: [SELECT ONE OF YOUR ACTUAL TABLE IDS]
server_id: [YOUR USER ID]
customer_count: 4
status: sent_to_kitchen
subtotal_amount: 125.50
tax_amount: 11.14
total_amount: 136.64
special_instructions: Birthday celebration
```

### Ticket 2 (Blue Dot - Preparing)  
```
ticket_number: T002
table_id: [SELECT ANOTHER TABLE ID]
server_id: [YOUR USER ID] 
customer_count: 2
status: preparing
subtotal_amount: 78.50
tax_amount: 6.97
total_amount: 85.47
special_instructions: 
```

### Ticket 3 (Green Dot - Ready)
```
ticket_number: T003
table_id: [SELECT ANOTHER TABLE ID]
server_id: [YOUR USER ID]
customer_count: 6  
status: ready
subtotal_amount: 245.75
tax_amount: 21.81
total_amount: 267.56
special_instructions: Anniversary dinner
```

## Step 3: Import Test Ticket Items

Go to the `ticket_items` collection and create these records:

### For Ticket 1 (T001)
```
ticket_id: [ID OF TICKET T001 YOU JUST CREATED]
menu_item_id: [SELECT ANY MENU ITEM ID]
quantity: 2
unit_price: 28.99
total_price: 57.98
modifications: Medium-Rare, Extra sauce
status: sent_to_kitchen
course: main
kitchen_station: grill
special_instructions: No onions
ordered_at: [CURRENT DATE/TIME]
seat_number: 1
seat_name: John
```

### For Ticket 2 (T002)
```
ticket_id: [ID OF TICKET T002]
menu_item_id: [SELECT ANY MENU ITEM ID]
quantity: 1
unit_price: 32.50
total_price: 32.50
modifications: Well done
status: preparing
course: main
kitchen_station: grill
special_instructions: 
ordered_at: [CURRENT DATE/TIME]
seat_number: 1
seat_name: 
```

### For Ticket 3 (T003)
```
ticket_id: [ID OF TICKET T003]
menu_item_id: [SELECT ANY MENU ITEM ID]
quantity: 3
unit_price: 45.50
total_price: 136.50
modifications: Sauce on side
status: ready
course: main
kitchen_station: grill
special_instructions: Anniversary special presentation
ordered_at: [CURRENT DATE/TIME]
seat_number: 1
seat_name: David
```

## Step 4: Check Results

After importing this data:

1. Go to your server dashboard
2. You should see:
   - **Table with T001**: 🟠 Orange dot (Cooking)
   - **Table with T002**: 🔵 Blue dot (Preparing)  
   - **Table with T003**: 🟢 Green pulsing dot (Ready)

3. Click on any of these tables to see the detailed order modal with timers and progress bars

## Troubleshooting

If tables still don't show status dots:

1. **Check table IDs**: Make sure the `table_id` in tickets matches your actual table IDs
2. **Check user ID**: Make sure `server_id` matches your user ID
3. **Refresh page**: Sometimes you need to refresh to see the changes
4. **Check console**: Open browser dev tools and check for any JavaScript errors

## Easy Method Using Browser Console

Alternatively, you can paste this into your browser console while on the server dashboard:

```javascript
// This will help debug the issue
console.log('Tickets:', $tickets);
console.log('Ticket Items:', $ticketItems);  
console.log('Tables:', $tables);

// Check what getTableOrderStatus returns for a specific table
const testTable = $tables[0]; // First table
if (testTable) {
    const status = getTableOrderStatus(testTable.id);
    console.log('Table status for', testTable.table_name, ':', status);
}
```

This will help identify if the data is loading correctly.
