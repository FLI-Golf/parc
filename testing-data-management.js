import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

// You'll need to authenticate first - replace with your admin credentials
await pb.admins.authWithPassword('your-admin-email', 'your-admin-password');

/**
 * TESTING DATA MANAGEMENT SYSTEM
 * 
 * Separates seed data (keep) from transaction data (clean)
 * Provides clean slate for testing while preserving restaurant setup
 */

const SEED_DATA_COLLECTIONS = [
    // Keep these - restaurant setup data
    'users',                    // Staff accounts
    'staff_collection',         // Staff details  
    'menu_collection',          // Menu items
    'menu_categories',          // Menu categories
    'menu_modifiers',           // Item modifiers
    'tables_collection',        // Restaurant tables
    'sections_collection',      // Restaurant sections
    'vendors_collection',       // Vendor information
    'inventory_collection',     // Inventory items
    'shifts_collection'         // Staff schedules (if you want to keep)
];

const TRANSACTION_DATA_COLLECTIONS = [
    // Clear these - operational transaction data
    'tickets_collection',       // Active orders
    'ticket_items_collection',  // Order items
    'payments_collection',      // Payment records
    'completed_orders',         // Historical orders
    'table_updates_collection'  // Table status changes
];

async function getCurrentState() {
    console.log('📊 CURRENT DATABASE STATE');
    console.log('==========================\n');
    
    const state = {};
    
    for (const collection of [...SEED_DATA_COLLECTIONS, ...TRANSACTION_DATA_COLLECTIONS]) {
        try {
            const records = await pb.collection(collection).getList(1, 50);
            state[collection] = records.totalItems;
            
            const type = SEED_DATA_COLLECTIONS.includes(collection) ? '🌱 SEED' : '💼 TRANSACTION';
            console.log(`${type} ${collection.padEnd(25)} : ${records.totalItems} records`);
        } catch (error) {
            console.log(`❌ ${collection.padEnd(30)} : ERROR - ${error.message}`);
        }
    }
    
    return state;
}

async function clearTransactionData() {
    console.log('\n🧹 CLEARING TRANSACTION DATA');
    console.log('=============================\n');
    
    for (const collection of TRANSACTION_DATA_COLLECTIONS) {
        try {
            console.log(`🗑️  Clearing ${collection}...`);
            
            // Get all records in batches and delete
            let hasMore = true;
            let totalDeleted = 0;
            
            while (hasMore) {
                const records = await pb.collection(collection).getList(1, 50);
                
                if (records.items.length === 0) {
                    hasMore = false;
                    break;
                }
                
                for (const record of records.items) {
                    await pb.collection(collection).delete(record.id);
                    totalDeleted++;
                }
                
                console.log(`   Deleted ${totalDeleted} records...`);
            }
            
            console.log(`✅ ${collection}: ${totalDeleted} records deleted`);
            
        } catch (error) {
            console.log(`❌ ${collection}: ERROR - ${error.message}`);
        }
    }
}

async function resetTableStatuses() {
    console.log('\n🏢 RESETTING TABLE STATUSES');
    console.log('============================\n');
    
    try {
        const tables = await pb.collection('tables_collection').getList(1, 100);
        
        for (const table of tables.items) {
            await pb.collection('tables_collection').update(table.id, {
                status_field: 'available',
                notes_field: ''
            });
        }
        
        console.log(`✅ Reset ${tables.items.length} tables to 'available' status`);
        
    } catch (error) {
        console.log(`❌ Error resetting tables: ${error.message}`);
    }
}

async function exportSeedData() {
    console.log('\n💾 EXPORTING SEED DATA');
    console.log('======================\n');
    
    const seedBackup = {
        timestamp: new Date().toISOString(),
        collections: {}
    };
    
    for (const collection of SEED_DATA_COLLECTIONS) {
        try {
            console.log(`📤 Exporting ${collection}...`);
            
            const allRecords = [];
            let page = 1;
            let hasMore = true;
            
            while (hasMore) {
                const records = await pb.collection(collection).getList(page, 50);
                allRecords.push(...records.items);
                
                hasMore = records.page < records.totalPages;
                page++;
            }
            
            seedBackup.collections[collection] = allRecords;
            console.log(`✅ ${collection}: ${allRecords.length} records exported`);
            
        } catch (error) {
            console.log(`❌ ${collection}: ${error.message}`);
        }
    }
    
    // Save to file
    const fs = await import('fs');
    const filename = `seed-data-backup-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(seedBackup, null, 2));
    
    console.log(`\n💾 Seed data saved to: ${filename}`);
    return filename;
}

async function generateTestData() {
    console.log('\n🧪 GENERATING TEST DATA');
    console.log('========================\n');
    
    try {
        // Create test tickets for different scenarios
        const tables = await pb.collection('tables_collection').getList(1, 10);
        const menuItems = await pb.collection('menu_collection').getList(1, 10);
        const staff = await pb.collection('staff_collection').getList(1, 5);
        
        if (tables.items.length === 0 || menuItems.items.length === 0 || staff.items.length === 0) {
            console.log('❌ Cannot generate test data - missing seed data (tables, menu, or staff)');
            return;
        }
        
        const testScenarios = [
            {
                name: 'Ready for Payment',
                table: tables.items[0],
                status: 'sent_to_kitchen',
                itemStatus: 'ready'
            },
            {
                name: 'Needs Manager Override', 
                table: tables.items[1],
                status: 'sent_to_kitchen',
                itemStatus: 'sent_to_kitchen'
            },
            {
                name: 'Mixed Status Order',
                table: tables.items[2], 
                status: 'sent_to_kitchen',
                itemStatus: 'mixed' // Some ready, some preparing
            }
        ];
        
        for (const scenario of testScenarios) {
            console.log(`🎭 Creating scenario: ${scenario.name}`);
            
            // Create ticket
            const ticket = await pb.collection('tickets_collection').create({
                table_id: scenario.table.id,
                server_id: staff.items[0].id,
                customer_count: 2,
                status: scenario.status,
                ticket_number: `TEST${Date.now()}`
            });
            
            // Add 2-3 menu items
            const itemsToAdd = menuItems.items.slice(0, Math.random() > 0.5 ? 2 : 3);
            
            for (const [index, menuItem] of itemsToAdd.entries()) {
                let itemStatus = scenario.itemStatus;
                
                // For mixed status, alternate between ready and preparing
                if (scenario.itemStatus === 'mixed') {
                    itemStatus = index % 2 === 0 ? 'ready' : 'preparing';
                }
                
                await pb.collection('ticket_items_collection').create({
                    ticket_id: ticket.id,
                    menu_item_id: menuItem.id,
                    quantity: 1,
                    unit_price: menuItem.price_field || 15.99,
                    total_price: menuItem.price_field || 15.99,
                    status: itemStatus,
                    ordered_at: new Date().toISOString()
                });
            }
            
            // Update table status
            await pb.collection('tables_collection').update(scenario.table.id, {
                status_field: 'occupied'
            });
            
            console.log(`✅ Created ${scenario.name} on ${scenario.table.table_name || scenario.table.table_number_field}`);
        }
        
    } catch (error) {
        console.log(`❌ Error generating test data: ${error.message}`);
    }
}

// Main execution functions
export async function cleanSlate() {
    console.log('🔄 PREPARING CLEAN TESTING ENVIRONMENT');
    console.log('=======================================\n');
    
    // 1. Show current state
    await getCurrentState();
    
    // 2. Export seed data as backup
    const backupFile = await exportSeedData();
    
    // 3. Clear transaction data
    await clearTransactionData();
    
    // 4. Reset table statuses
    await resetTableStatuses();
    
    // 5. Show final state
    console.log('\n📊 FINAL CLEAN STATE');
    console.log('====================');
    await getCurrentState();
    
    console.log('\n✅ SYSTEM READY FOR TESTING');
    console.log(`💾 Seed data backed up to: ${backupFile}`);
    console.log('\n🧪 Next steps:');
    console.log('1. Run: await generateTestData() for test scenarios');
    console.log('2. Or start fresh testing manually');
}

export async function setupTestScenarios() {
    console.log('🎭 SETTING UP TEST SCENARIOS');
    console.log('=============================\n');
    
    await generateTestData();
    
    console.log('\n✅ TEST SCENARIOS READY');
    console.log('\n🧪 Available test scenarios:');
    console.log('1. Table with items ready for payment');
    console.log('2. Table needing manager override');
    console.log('3. Table with mixed item statuses');
    console.log('\n💡 Test the payment workflow, manager overrides, and recovery!');
}

// Export for direct usage
export { getCurrentState, clearTransactionData, resetTableStatuses, exportSeedData, generateTestData };
