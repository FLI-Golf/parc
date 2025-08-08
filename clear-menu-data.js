#!/usr/bin/env node

import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app/');

// Admin authentication
const adminEmail = 'ddinsmore8@gmail.com';
const adminPassword = 'MADcap(123)';

async function clearAllMenuData() {
    try {
        // Authenticate as admin
        console.log('🔐 Authenticating as admin...');
        await pb.admins.authWithPassword(adminEmail, adminPassword);
        console.log('✅ Admin authenticated successfully');

        // Collections to clear in order (dependencies first)
        const collections = [
            'ticket_items_collection',
            'tickets_collection', 
            'menu_modifiers',
            'menu_items',
            'menu_categories'
        ];

        for (const collectionName of collections) {
            try {
                console.log(`🗑️  Clearing ${collectionName}...`);
                const existing = await pb.collection(collectionName).getFullList();
                
                if (existing.length === 0) {
                    console.log(`ℹ️  No data in ${collectionName}`);
                    continue;
                }

                for (const item of existing) {
                    await pb.collection(collectionName).delete(item.id);
                }
                
                console.log(`✅ Cleared ${existing.length} items from ${collectionName}`);
            } catch (error) {
                console.log(`⚠️  Could not clear ${collectionName}: ${error.message}`);
            }
        }

        console.log('🎉 All menu data cleared successfully!');
        console.log('📝 Ready for fresh menu import.');
        
    } catch (error) {
        console.error('❌ Clear failed:', error);
        process.exit(1);
    }
}

clearAllMenuData();
