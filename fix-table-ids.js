const PocketBase = require('pocketbase/cjs');

// PocketBase connection
const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function fixTableIds() {
    try {
        console.log('🔐 Authenticating...');
        // You'll need to replace these with your admin credentials
        await pb.admins.authWithPassword('admin@example.com', 'your-admin-password');
        
        console.log('📊 Fetching current tables...');
        const tables = await pb.collection('tables_collection').getFullList();
        
        console.log('🏢 Current Tables:');
        tables.forEach((table, index) => {
            console.log(`  ${index + 1}. ID: ${table.id} - Name: ${table.table_name || table.table_number_field} (${table.seats_field || table.capacity} seats)`);
        });
        
        // If you have T1, T2, T3, T4, T5, T6 tables, let's map them
        const t1 = tables.find(t => (t.table_name || t.table_number_field) === 'T1');
        const t2 = tables.find(t => (t.table_name || t.table_number_field) === 'T2'); 
        const t3 = tables.find(t => (t.table_name || t.table_number_field) === 'T3');
        
        if (!t1 || !t2 || !t3) {
            console.log('❌ Could not find T1, T2, or T3 tables');
            console.log('💡 Make sure your tables are named T1, T2, T3, etc.');
            return;
        }
        
        console.log('\n🎯 Found target tables:');
        console.log(`  T1 ID: ${t1.id}`);
        console.log(`  T2 ID: ${t2.id}`);
        console.log(`  T3 ID: ${t3.id}`);
        
        // Now let's create test tickets with the correct table IDs
        console.log('\n📋 Creating test tickets with correct table IDs...');
        
        // First, let's clean up any existing test tickets
        try {
            const existingTickets = await pb.collection('tickets_collection').getFullList({
                filter: 'ticket_number ~ "T00"'
            });
            
            for (const ticket of existingTickets) {
                await pb.collection('tickets_collection').delete(ticket.id);
                console.log(`🗑️  Deleted old test ticket: ${ticket.ticket_number}`);
            }
        } catch (cleanupError) {
            console.log('ℹ️  No existing test tickets to clean up');
        }
        
        // Get your user ID (assuming you're logged in as the server)
        let userId;
        try {
            const users = await pb.collection('users').getFullList({
                filter: 'email = "marie@restaurant.com"' // Adjust this to your server email
            });
            if (users.length > 0) {
                userId = users[0].id;
                console.log(`👤 Found user ID: ${userId}`);
            }
        } catch (userError) {
            console.log('⚠️  Could not find user ID, using placeholder');
            userId = 'user_placeholder';
        }
        
        // Create tickets with correct table IDs
        const tickets = [
            {
                ticket_number: "T001",
                table_id: t1.id, // Use real T1 table ID
                server_id: userId,
                customer_count: 4,
                status: "sent_to_kitchen",
                subtotal_amount: 125.50,
                tax_amount: 11.14,
                total_amount: 136.64,
                special_instructions: "Birthday celebration"
            },
            {
                ticket_number: "T002",
                table_id: t2.id, // Use real T2 table ID
                server_id: userId,
                customer_count: 2,
                status: "preparing", 
                subtotal_amount: 78.50,
                tax_amount: 6.97,
                total_amount: 85.47,
                special_instructions: ""
            },
            {
                ticket_number: "T003",
                table_id: t3.id, // Use real T3 table ID
                server_id: userId,
                customer_count: 6,
                status: "ready",
                subtotal_amount: 245.75,
                tax_amount: 21.81,
                total_amount: 267.56,
                special_instructions: "Anniversary dinner"
            }
        ];
        
        // Get some menu items for the ticket items
        console.log('\n🍽️  Fetching menu items...');
        const menuItems = await pb.collection('menu_collection').getFullList({
            sort: 'created',
            limit: 5
        });
        
        if (menuItems.length === 0) {
            console.log('❌ No menu items found! You need menu items to create ticket items.');
            return;
        }
        
        console.log(`📋 Found ${menuItems.length} menu items to use`);
        
        // Import tickets
        for (const ticketData of tickets) {
            try {
                const ticket = await pb.collection('tickets_collection').create(ticketData);
                console.log(`✅ Created ticket: ${ticket.ticket_number} for table ${ticketData.table_id}`);
                
                // Create ticket items for this ticket
                const now = new Date();
                const orderedAt = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
                
                // Create different items for each ticket
                let itemsToCreate = [];
                
                if (ticket.ticket_number === 'T001') {
                    // For T1 table
                    itemsToCreate = [
                        {
                            ticket_id: ticket.id,
                            menu_item_id: menuItems[0]?.id,
                            quantity: 2,
                            unit_price: 28.99,
                            total_price: 57.98,
                            modifications: "Medium-Rare, Extra sauce",
                            status: "sent_to_kitchen",
                            course: "main",
                            kitchen_station: "grill",
                            special_instructions: "No onions",
                            ordered_at: orderedAt.toISOString(),
                            seat_number: 1,
                            seat_name: "John"
                        }
                    ];
                } else if (ticket.ticket_number === 'T002') {
                    itemsToCreate = [
                        {
                            ticket_id: ticket.id,
                            menu_item_id: menuItems[1]?.id || menuItems[0]?.id,
                            quantity: 1,
                            unit_price: 32.50,
                            total_price: 32.50,
                            modifications: "Well done",
                            status: "preparing",
                            course: "main", 
                            kitchen_station: "grill",
                            special_instructions: "",
                            ordered_at: orderedAt.toISOString(),
                            seat_number: 1,
                            seat_name: ""
                        }
                    ];
                } else if (ticket.ticket_number === 'T003') {
                    itemsToCreate = [
                        {
                            ticket_id: ticket.id,
                            menu_item_id: menuItems[2]?.id || menuItems[0]?.id,
                            quantity: 3,
                            unit_price: 45.50,
                            total_price: 136.50,
                            modifications: "Sauce on side",
                            status: "ready",
                            course: "main",
                            kitchen_station: "grill", 
                            special_instructions: "Anniversary special presentation",
                            ordered_at: orderedAt.toISOString(),
                            seat_number: 1,
                            seat_name: "David"
                        }
                    ];
                }
                
                for (const itemData of itemsToCreate) {
                    try {
                        await pb.collection('ticket_items_collection').create(itemData);
                        console.log(`  ✅ Created item: ${itemData.quantity}x ${menuItems.find(m => m.id === itemData.menu_item_id)?.name || 'menu item'}`);
                    } catch (itemError) {
                        console.error(`  ❌ Error creating item:`, itemError.message);
                    }
                }
                
            } catch (ticketError) {
                console.error(`❌ Error creating ticket ${ticketData.ticket_number}:`, ticketError.message);
            }
        }
        
        console.log('\n🎉 Test orders created with correct table IDs!');
        console.log('💡 Now check your server dashboard - T1 should show an orange dot, T2 blue dot, T3 green dot');
        console.log('🔍 Use the "Debug Tables" button in the dashboard to verify the data');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n📝 To fix this:');
        console.log('1. Update the admin credentials in this script (lines 8-9)');
        console.log('2. Update the server email filter if needed (line 38)');
        console.log('3. Make sure your collections exist: tables_collection, tickets_collection, ticket_items_collection, menu_collection');
    }
}

// Run the script
fixTableIds();
