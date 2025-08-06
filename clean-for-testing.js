import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

// TODO: Replace with your actual admin credentials
// await pb.admins.authWithPassword('admin-email', 'admin-password');

async function quickClean() {
    console.log('🧹 QUICK CLEAN FOR TESTING');
    console.log('===========================\n');
    
    const transactionCollections = [
        'tickets_collection',
        'ticket_items_collection', 
        'payments_collection',
        'completed_orders'
    ];
    
    console.log('🔍 Current transaction data:');
    
    // Show current state
    for (const collection of transactionCollections) {
        try {
            const records = await pb.collection(collection).getList(1, 1);
            console.log(`📊 ${collection}: ${records.totalItems} records`);
        } catch (error) {
            console.log(`❌ ${collection}: ${error.message}`);
        }
    }
    
    console.log('\n⚠️  WARNING: This will delete ALL transaction data!');
    console.log('✅ This will KEEP: menu items, tables, staff (seed data)');
    console.log('❌ This will DELETE: active orders, payments, history');
    
    // In a real scenario, you'd want confirmation here
    // For now, let's just show what would be deleted
    
    console.log('\n💡 TO PROCEED:');
    console.log('1. Uncomment the admin auth line above');
    console.log('2. Add your admin credentials'); 
    console.log('3. Uncomment the deletion code below');
    
    /*
    // UNCOMMENT TO ACTUALLY DELETE:
    
    for (const collection of transactionCollections) {
        try {
            console.log(`\n🗑️  Clearing ${collection}...`);
            let deleted = 0;
            
            while (true) {
                const records = await pb.collection(collection).getList(1, 50);
                if (records.items.length === 0) break;
                
                for (const record of records.items) {
                    await pb.collection(collection).delete(record.id);
                    deleted++;
                }
                console.log(`   Deleted ${deleted} records...`);
            }
            
            console.log(`✅ ${collection}: ${deleted} total deleted`);
            
        } catch (error) {
            console.log(`❌ ${collection}: ${error.message}`);
        }
    }
    
    // Reset all tables to available
    try {
        const tables = await pb.collection('tables_collection').getList(1, 100);
        for (const table of tables.items) {
            await pb.collection('tables_collection').update(table.id, {
                status_field: 'available',
                notes_field: ''
            });
        }
        console.log(`\n🏢 Reset ${tables.items.length} tables to available`);
    } catch (error) {
        console.log(`❌ Error resetting tables: ${error.message}`);
    }
    
    console.log('\n✅ SYSTEM CLEANED - READY FOR TESTING!');
    */
}

quickClean();
