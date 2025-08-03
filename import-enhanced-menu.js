import PocketBase from 'pocketbase';
import fs from 'fs';
import csv from 'csv-parser';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

// Admin authentication
async function authenticate() {
    try {
        await pb.admins.authWithPassword('admin@parc.com', 'parcadmin123');
        console.log('✅ Authenticated as admin');
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        process.exit(1);
    }
}

// Helper function to parse CSV and return array of objects
function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

// Helper to convert string boolean values
function parseBoolean(value) {
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    return Boolean(value);
}

// Helper to parse number values
function parseNumber(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
}

// Helper to parse array fields (comma-separated strings)
function parseArray(value) {
    if (!value || value.trim() === '') return [];
    return value.split(',').map(item => item.trim()).filter(item => item !== '');
}

// Import menu categories
async function importMenuCategories() {
    console.log('\n📁 Importing menu categories...');
    
    try {
        const categories = await parseCSV('./static/sample-data/menu_categories.csv');
        console.log(`Found ${categories.length} categories to import`);

        for (const category of categories) {
            try {
                const categoryData = {
                    name: category.name.replace(/"/g, ''),
                    icon: category.icon,
                    color: category.color,
                    sort_order: parseNumber(category.sort_order),
                    active: parseBoolean(category.active),
                    description: category.description.replace(/"/g, '')
                };

                const record = await pb.collection('menu_categories').create(categoryData);
                console.log(`✅ Created category: ${categoryData.name}`);
            } catch (error) {
                console.error(`❌ Error creating category ${category.name}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error importing categories:', error.message);
    }
}

// Import menu modifiers
async function importMenuModifiers() {
    console.log('\n🔧 Importing menu modifiers...');
    
    try {
        const modifiers = await parseCSV('./static/sample-data/menu_modifiers.csv');
        console.log(`Found ${modifiers.length} modifiers to import`);

        for (const modifier of modifiers) {
            try {
                const modifierData = {
                    name: modifier.name.replace(/"/g, ''),
                    type: modifier.type,
                    price_change: parseNumber(modifier.price_change),
                    required: parseBoolean(modifier.required),
                    sort_order: parseNumber(modifier.sort_order)
                };

                const record = await pb.collection('menu_modifiers').create(modifierData);
                console.log(`✅ Created modifier: ${modifierData.name}`);
            } catch (error) {
                console.error(`❌ Error creating modifier ${modifier.name}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error importing modifiers:', error.message);
    }
}

// Import menu items
async function importMenuItems() {
    console.log('\n🍽️ Importing menu items...');
    
    try {
        const items = await parseCSV('./static/sample-data/menu_items.csv');
        console.log(`Found ${items.length} menu items to import`);

        for (const item of items) {
            try {
                const itemData = {
                    name: item.name.replace(/"/g, ''),
                    description: item.description.replace(/"/g, ''),
                    category: item.category,
                    subcategory: item.subcategory || '',
                    price: parseNumber(item.price),
                    cost: parseNumber(item.cost),
                    ingredients: item.ingredients.replace(/"/g, ''),
                    allergens: parseArray(item.allergens),
                    preparation_time: parseNumber(item.preparation_time),
                    available: parseBoolean(item.available),
                    tags: parseArray(item.tags),
                    sort_order: parseNumber(item.sort_order),
                    portion_size: item.portion_size || '',
                    spice_level: parseNumber(item.spice_level),
                    dietary_flags: parseArray(item.dietary_flags),
                    kitchen_notes: item.kitchen_notes.replace(/"/g, ''),
                    calories: parseNumber(item.calories),
                    featured: parseBoolean(item.featured)
                };

                const record = await pb.collection('menu_collection').create(itemData);
                console.log(`✅ Created menu item: ${itemData.name} - $${itemData.price}`);
            } catch (error) {
                console.error(`❌ Error creating menu item ${item.name}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error importing menu items:', error.message);
    }
}

// Clear existing data (optional)
async function clearExistingData() {
    console.log('\n🗑️ Clearing existing menu data...');
    
    try {
        // Clear menu items
        const existingItems = await pb.collection('menu_collection').getFullList();
        for (const item of existingItems) {
            await pb.collection('menu_collection').delete(item.id);
        }
        console.log(`✅ Cleared ${existingItems.length} existing menu items`);

        // Clear categories (if collection exists)
        try {
            const existingCategories = await pb.collection('menu_categories').getFullList();
            for (const category of existingCategories) {
                await pb.collection('menu_categories').delete(category.id);
            }
            console.log(`✅ Cleared ${existingCategories.length} existing categories`);
        } catch (e) {
            console.log('ℹ️ No existing categories collection found');
        }

        // Clear modifiers (if collection exists)
        try {
            const existingModifiers = await pb.collection('menu_modifiers').getFullList();
            for (const modifier of existingModifiers) {
                await pb.collection('menu_modifiers').delete(modifier.id);
            }
            console.log(`✅ Cleared ${existingModifiers.length} existing modifiers`);
        } catch (e) {
            console.log('ℹ️ No existing modifiers collection found');
        }
    } catch (error) {
        console.error('❌ Error clearing existing data:', error.message);
    }
}

// Main import function
async function main() {
    console.log('🚀 Starting French Menu Import Process...');
    
    await authenticate();
    
    // Ask user if they want to clear existing data
    const args = process.argv.slice(2);
    if (args.includes('--clear')) {
        await clearExistingData();
    }
    
    // Import in order
    await importMenuCategories();
    await importMenuModifiers();
    await importMenuItems();
    
    console.log('\n🎉 French menu import completed!');
    console.log('\nImported:');
    console.log('- Menu categories with French styling');
    console.log('- Authentic French menu items with full details');
    console.log('- French cooking modifiers and sauces');
    console.log('\nYour POS system is now ready with a complete French menu!');
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

main().catch(console.error);
