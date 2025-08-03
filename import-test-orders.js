const PocketBase = require('pocketbase/cjs');

// PocketBase connection
const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function importTestOrders() {
    try {
        console.log('🔐 Authenticating...');
        // You'll need to replace these with your admin credentials
        await pb.admins.authWithPassword('admin@example.com', 'your-admin-password');
        
        console.log('📋 Importing test tickets...');
        
        // Sample tickets
        const tickets = [
            {
                ticket_number: "T001",
                table_id: "table_001", // Make sure this matches your actual table IDs
                server_id: "your_user_id", // Replace with your actual user ID
                customer_count: 4,
                status: "sent_to_kitchen",
                subtotal_amount: 125.50,
                tax_amount: 11.14,
                total_amount: 136.64,
                special_instructions: "Birthday celebration"
            },
            {
                ticket_number: "T002",
                table_id: "table_002",
                server_id: "your_user_id",
                customer_count: 2,
                status: "preparing", 
                subtotal_amount: 78.50,
                tax_amount: 6.97,
                total_amount: 85.47,
                special_instructions: ""
            },
            {
                ticket_number: "T003",
                table_id: "table_003", 
                server_id: "your_user_id",
                customer_count: 6,
                status: "ready",
                subtotal_amount: 245.75,
                tax_amount: 21.81,
                total_amount: 267.56,
                special_instructions: "Anniversary dinner"
            }
        ];

        // Import tickets
        for (const ticketData of tickets) {
            try {
                const ticket = await pb.collection('tickets_collection').create(ticketData);
                console.log(`✅ Created ticket: ${ticket.ticket_number}`);
                
                // Create ticket items for this ticket
                const sampleItems = getSampleItems(ticket.id, ticket.ticket_number);
                
                for (const itemData of sampleItems) {
                    try {
                        await pb.collection('ticket_items_collection').create(itemData);
                        console.log(`  ✅ Created item: ${itemData.quantity}x menu item`);
                    } catch (itemError) {
                        console.error(`  ❌ Error creating item:`, itemError.message);
                    }
                }
                
            } catch (ticketError) {
                console.error(`❌ Error creating ticket ${ticketData.ticket_number}:`, ticketError.message);
            }
        }
        
        console.log('🎉 Test orders imported successfully!');
        console.log('💡 Now check your server dashboard - tables should show colored status dots');
        
    } catch (error) {
        console.error('❌ Error importing test orders:', error.message);
        console.log('\n📝 To fix this:');
        console.log('1. Update the admin credentials in this script');
        console.log('2. Make sure your table IDs match (check your PocketBase tables collection)');
        console.log('3. Update the server_id with your actual user ID');
    }
}

function getSampleItems(ticketId, ticketNumber) {
    const now = new Date();
    const orderedAt = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
    
    if (ticketNumber === 'T001') {
        return [
            {
                ticket_id: ticketId,
                menu_item_id: "menu_001", // Make sure these menu IDs exist
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
            },
            {
                ticket_id: ticketId,
                menu_item_id: "menu_002",
                quantity: 1,
                unit_price: 12.99,
                total_price: 12.99,
                modifications: "",
                status: "sent_to_kitchen",
                course: "drink",
                kitchen_station: "bar",
                special_instructions: "Extra ice", 
                ordered_at: orderedAt.toISOString(),
                seat_number: 2,
                seat_name: "Sarah"
            }
        ];
    } else if (ticketNumber === 'T002') {
        return [
            {
                ticket_id: ticketId,
                menu_item_id: "menu_003",
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
    } else if (ticketNumber === 'T003') {
        return [
            {
                ticket_id: ticketId,
                menu_item_id: "menu_004",
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
    
    return [];
}

// Run the import
importTestOrders();
