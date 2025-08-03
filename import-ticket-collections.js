#!/usr/bin/env node

import fs from 'fs';
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app/');

async function importTicketCollections() {
    try {
        console.log('🎫 Importing ticket system collections...');
        
        // Read the ticket collections schema
        const collectionsData = fs.readFileSync('./ticket_system_collections.json', 'utf8');
        const collections = JSON.parse(collectionsData);
        
        // Try to import without authentication first (for collection creation)
        for (const collection of collections) {
            try {
                console.log(`📦 Creating collection: ${collection.name}`);
                
                // Create collection via admin API
                const response = await fetch('https://pocketbase-production-7050.up.railway.app/api/collections', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(collection)
                });

                if (response.ok) {
                    console.log(`✅ Created ${collection.name} collection`);
                } else {
                    const error = await response.text();
                    console.error(`❌ Failed to create ${collection.name}:`, error);
                }
            } catch (error) {
                console.error(`❌ Error creating ${collection.name}:`, error.message);
            }
        }

        console.log('🎉 Ticket collections import process completed!');
        console.log('⚠️  Note: If creation failed due to permissions, you need to create these collections manually in PocketBase admin panel.');
        console.log('🔗 Go to: https://pocketbase-production-7050.up.railway.app/_/');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
    }
}

importTicketCollections();
