const PocketBase = require('pocketbase/cjs');

// PocketBase connection
const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function fixTicketTableId() {
    try {
        console.log('🔐 Authenticating...');
        // You'll need to replace these with your admin credentials
        await pb.admins.authWithPassword('admin@example.com', 'your-admin-password');
        
        // The ticket ID from your debug output
        const ticketId = 'xlks2ixn6n077jn';
        
        // Your T1 table ID (PD1) from the debug output  
        const t1TableId = '326f32ui97pt847';
        
        console.log('📝 Updating ticket to point to T1 table...');
        
        // Update the ticket to use the correct table ID
        await pb.collection('tickets_collection').update(ticketId, {
            table_id: t1TableId
        });
        
        console.log('✅ Successfully updated ticket!');
        console.log('🎯 Ticket xlks2ixn6n077jn now points to table 326f32ui97pt847 (PD1/T1)');
        console.log('💡 Now refresh your server dashboard - T1 should show an orange dot (cooking status)');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n📝 To fix this:');
        console.log('1. Update the admin credentials in this script (line 8)');
        console.log('2. Make sure you have admin access to PocketBase');
    }
}

// Run the script
fixTicketTableId();
