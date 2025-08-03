import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function setupCollections() {
  try {
    console.log('Setting up missing collections...');
    
    // First, let's check what collections currently exist
    try {
      const existingCollections = await pb.collections.getFullList();
      console.log('Existing collections:', existingCollections.map(c => c.id));
    } catch (error) {
      console.log('Cannot list collections (need admin auth):', error.message);
    }

    // Collection schemas to create
    const collections = [
      {
        id: 'inventory_collection',
        name: 'inventory',
        type: 'base',
        schema: [
          { name: 'item_name_field', type: 'text', required: true },
          { name: 'category_field', type: 'text' },
          { name: 'quantity_field', type: 'number' },
          { name: 'unit_field', type: 'text' },
          { name: 'cost_per_unit_field', type: 'number' },
          { name: 'vendor_field', type: 'relation', options: { collectionId: 'vendors_collection' } },
          { name: 'reorder_level_field', type: 'number' },
          { name: 'location_field', type: 'text' }
        ]
      },
      {
        id: 'staff_collection',
        name: 'staff',
        type: 'base',
        schema: [
          { name: 'first_name_field', type: 'text', required: true },
          { name: 'last_name_field', type: 'text', required: true },
          { name: 'position_field', type: 'text' },
          { name: 'phone_field', type: 'text' },
          { name: 'email_field', type: 'email' },
          { name: 'hire_date_field', type: 'date' },
          { name: 'hourly_rate_field', type: 'number' },
          { name: 'user_id', type: 'relation', options: { collectionId: '_pb_users_auth_' } }
        ]
      },
      {
        id: 'menu_collection',
        name: 'menu',
        type: 'base',
        schema: [
          { name: 'item_name_field', type: 'text', required: true },
          { name: 'description_field', type: 'text' },
          { name: 'price_field', type: 'number' },
          { name: 'category_field', type: 'text' },
          { name: 'available_field', type: 'bool', default: true },
          { name: 'ingredients_field', type: 'json' }
        ]
      },
      {
        id: 'events_collection',
        name: 'events',
        type: 'base',
        schema: [
          { name: 'event_name_field', type: 'text', required: true },
          { name: 'event_date_field', type: 'date' },
          { name: 'start_time_field', type: 'text' },
          { name: 'end_time_field', type: 'text' },
          { name: 'description_field', type: 'text' },
          { name: 'capacity_field', type: 'number' },
          { name: 'status_field', type: 'text' }
        ]
      },
      {
        id: 'tables_collection',
        name: 'tables',
        type: 'base',
        schema: [
          { name: 'table_number_field', type: 'text', required: true },
          { name: 'section_field', type: 'relation', options: { collectionId: 'sections_collection' } },
          { name: 'seats_field', type: 'number' },
          { name: 'status_field', type: 'text' }
        ]
      },
      {
        id: 'maintenance_records',
        name: 'maintenance_records',
        type: 'base',
        schema: [
          { name: 'equipment_field', type: 'text', required: true },
          { name: 'maintenance_date_field', type: 'date' },
          { name: 'description_field', type: 'text' },
          { name: 'cost_field', type: 'number' },
          { name: 'performed_by_field', type: 'text' },
          { name: 'status_field', type: 'text' }
        ]
      },
      {
        id: 'maintenance_schedules',
        name: 'maintenance_schedules',
        type: 'base',
        schema: [
          { name: 'equipment_field', type: 'text', required: true },
          { name: 'frequency_field', type: 'text' },
          { name: 'next_due_field', type: 'date' },
          { name: 'description_field', type: 'text' },
          { name: 'priority_field', type: 'text' }
        ]
      },
      {
        id: 'maintenance_tasks',
        name: 'maintenance_tasks',
        type: 'base',
        schema: [
          { name: 'task_name_field', type: 'text', required: true },
          { name: 'equipment_field', type: 'text' },
          { name: 'due_date_field', type: 'date' },
          { name: 'assigned_to_field', type: 'text' },
          { name: 'status_field', type: 'text' },
          { name: 'instructions_field', type: 'text' }
        ]
      },
      {
        id: 'maintenance_tasks_collection',
        name: 'maintenance_tasks_collection',
        type: 'base',
        schema: [
          { name: 'task_name_field', type: 'text', required: true },
          { name: 'equipment_field', type: 'text' },
          { name: 'due_date_field', type: 'date' },
          { name: 'assigned_to_field', type: 'text' },
          { name: 'status_field', type: 'text' },
          { name: 'instructions_field', type: 'text' }
        ]
      },
      {
        id: 'maintenance_records_collection',
        name: 'maintenance_records_collection',
        type: 'base',
        schema: [
          { name: 'equipment_field', type: 'text', required: true },
          { name: 'maintenance_date_field', type: 'date' },
          { name: 'description_field', type: 'text' },
          { name: 'cost_field', type: 'number' },
          { name: 'performed_by_field', type: 'text' },
          { name: 'status_field', type: 'text' }
        ]
      }
    ];

    // Since we can't authenticate as admin without credentials,
    // let's output the collection creation commands for manual execution
    console.log('\n=== Collection Creation Commands ===');
    console.log('You need to create these collections manually in the admin panel:');
    console.log('URL: https://pocketbase-production-7050.up.railway.app/_/');
    
    collections.forEach(collection => {
      console.log(`\n${collection.name.toUpperCase()} Collection:`);
      console.log(`ID: ${collection.id}`);
      console.log(`Name: ${collection.name}`);
      console.log('Schema:');
      collection.schema.forEach(field => {
        console.log(`  - ${field.name}: ${field.type}${field.required ? ' (required)' : ''}`);
      });
    });

    console.log('\n=== Alternative: JSON Schema Files ===');
    console.log('Creating JSON files for each collection that can be imported...');
    
    // Create JSON files for each collection
    const fs = await import('fs');
    
    collections.forEach(collection => {
      const filename = `${collection.id}_schema.json`;
      fs.writeFileSync(filename, JSON.stringify(collection, null, 2));
      console.log(`Created: ${filename}`);
    });

    console.log('\nTo import: Use the admin panel import feature with these JSON files.');

  } catch (error) {
    console.error('Error setting up collections:', error);
  }
}

setupCollections();
