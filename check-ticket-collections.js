#!/usr/bin/env node

import fs from 'fs';

async function checkTicketCollections() {
    const baseUrl = 'https://pocketbase-production-7050.up.railway.app';
    
    // Test collections we need for tickets
    const requiredCollections = [
        'tickets',
        'ticket_items', 
        'payments'
    ];
    
    console.log('🔍 Checking ticket system collections...\n');
    
    for (const collection of requiredCollections) {
        try {
            const response = await fetch(`${baseUrl}/api/collections/${collection}`);
            
            if (response.status === 404) {
                console.log(`❌ ${collection} - MISSING`);
            } else if (response.status === 401) {
                console.log(`✅ ${collection} - EXISTS (auth required)`);
            } else {
                console.log(`✅ ${collection} - EXISTS`);
            }
        } catch (error) {
            console.log(`❌ ${collection} - ERROR: ${error.message}`);
        }
    }
    
    console.log('\n📋 Collections needed:');
    console.log('   - tickets (for main ticket records)');
    console.log('   - ticket_items (for individual menu items on tickets)');
    console.log('   - payments (for payment processing)');
    
    console.log('\n🛠️ To create missing collections:');
    console.log('   1. Go to: https://pocketbase-production-7050.up.railway.app/_/');
    console.log('   2. Import: ticket_system_collections.json');
    console.log('   3. Refresh your dashboard and try adding items again');
}

checkTicketCollections();
