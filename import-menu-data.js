#!/usr/bin/env node

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app/');

// User authentication - using your account
const userEmail = 'marie.rousseau@parcbistro.com';
const userPassword = 'password123';

async function importMenuData() {
    try {
        // Authenticate as user
        console.log('🔐 Authenticating as user...');
        await pb.collection('users').authWithPassword(userEmail, userPassword);
        console.log('✅ User authenticated successfully');

        // Read menu items CSV
        console.log('📖 Reading menu items from CSV...');
        const csvData = fs.readFileSync('./static/sample-data/menu_items_final.csv', 'utf8');
        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true
        });

        console.log(`📊 Found ${records.length} menu items to import`);

        // Clear existing menu items
        console.log('🗑️ Clearing existing menu items...');
        try {
            const existing = await pb.collection('menu_collection').getFullList();
            for (const item of existing) {
                await pb.collection('menu_collection').delete(item.id);
            }
            console.log(`✅ Cleared ${existing.length} existing menu items`);
        } catch (error) {
            console.log('ℹ️ No existing menu items to clear');
        }

        // Import new menu items
        console.log('📥 Importing menu items...');
        let imported = 0;
        
        for (const record of records) {
            try {
                const menuItem = {
                    name_field: record.name,
                    description_field: record.description,
                    category_field: record.category,
                    subcategory_field: record.subcategory || '',
                    price_field: parseFloat(record.price) || 0,
                    cost_field: parseFloat(record.cost) || 0,
                    ingredients_field: record.ingredients || '',
                    allergens_field: record.allergens || '',
                    preparation_time_field: parseInt(record.preparation_time) || 0,
                    available_field: record.available === 'true',
                    tags_field: record.tags || '',
                    sort_order_field: parseInt(record.sort_order) || 0,
                    portion_size_field: record.portion_size || '',
                    spice_level_field: parseInt(record.spice_level) || 0,
                    dietary_flags_field: record.dietary_flags || '',
                    kitchen_notes_field: record.kitchen_notes || '',
                    calories_field: parseInt(record.calories) || 0,
                    featured_field: record.featured === 'true'
                };

                await pb.collection('menu_collection').create(menuItem);
                imported++;
                
                if (imported % 10 === 0) {
                    console.log(`📥 Imported ${imported}/${records.length} menu items...`);
                }
            } catch (error) {
                console.error(`❌ Failed to import menu item "${record.name}":`, error.message);
            }
        }

        console.log(`✅ Successfully imported ${imported} menu items!`);

        // Also import tables if they're missing
        console.log('🍽️ Checking tables...');
        try {
            const existingTables = await pb.collection('tables_collection').getFullList();
            if (existingTables.length === 0) {
                console.log('📖 Reading tables from CSV...');
                const tablesData = fs.readFileSync('./static/sample-data/tables.csv', 'utf8');
                const tableRecords = parse(tablesData, {
                    columns: true,
                    skip_empty_lines: true
                });

                for (const table of tableRecords) {
                    const tableData = {
                        table_number_field: parseInt(table.table_number),
                        section_field: table.section,
                        capacity_field: parseInt(table.capacity),
                        status_field: table.status || 'available',
                        x_position_field: parseInt(table.x_position) || 0,
                        y_position_field: parseInt(table.y_position) || 0
                    };

                    await pb.collection('tables_collection').create(tableData);
                }
                console.log(`✅ Imported ${tableRecords.length} tables`);
            } else {
                console.log(`ℹ️ Tables already exist (${existingTables.length} tables)`);
            }
        } catch (error) {
            console.error('❌ Error importing tables:', error.message);
        }

        console.log('🎉 Menu data import completed!');
        console.log('🔄 Try refreshing your server dashboard - the menu should now appear.');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    }
}

importMenuData();
