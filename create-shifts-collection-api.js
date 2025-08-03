/**
 * Script to create the missing shifts_collection via API
 */

const PB_URL = 'https://pocketbase-production-7050.up.railway.app';

async function createShiftsCollection() {
    try {
        console.log('Authenticating as admin...');
        
        // First authenticate as admin
        const authResponse = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identity: 'ddinsmore8@gmail.com',
                password: 'MADcap(123)'
            })
        });
        
        if (!authResponse.ok) {
            const authError = await authResponse.text();
            console.error('Auth failed:', authError);
            return;
        }
        
        const authData = await authResponse.json();
        console.log('✅ Authenticated successfully');
        
        const token = authData.token;
        
        // Check existing collections first
        console.log('Checking existing collections...');
        const existingResponse = await fetch(`${PB_URL}/api/collections`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (existingResponse.ok) {
            const collections = await existingResponse.json();
            console.log('Existing collections:', collections.items.map(c => c.name));
            
            // Check if shifts_collection already exists
            const shiftsExists = collections.items.find(c => c.id === 'shifts_collection');
            if (shiftsExists) {
                console.log('✅ shifts_collection already exists');
                return;
            }
        }
        
        // Create the shifts collection
        console.log('Creating shifts_collection...');
        
        const collectionSchema = {
            "id": "pb_shifts_colle",
            "name": "shifts_collection",
            "type": "base",
            "system": false,
            "schema": [
                {
                    "id": "staff_member",
                    "name": "staff_member",
                    "type": "text",
                    "system": false,
                    "required": true,
                    "unique": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": ""
                    }
                },
                {
                    "id": "shift_date",
                    "name": "shift_date",
                    "type": "date",
                    "system": false,
                    "required": true,
                    "unique": false,
                    "options": {
                        "min": "",
                        "max": ""
                    }
                },
                {
                    "id": "start_time",
                    "name": "start_time",
                    "type": "text",
                    "system": false,
                    "required": true,
                    "unique": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                    }
                },
                {
                    "id": "end_time",
                    "name": "end_time",
                    "type": "text",
                    "system": false,
                    "required": true,
                    "unique": false,
                    "options": {
                        "min": null,
                        "max": null,
                        "pattern": "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
                    }
                },
                {
                    "id": "break_duration",
                    "name": "break_duration",
                    "type": "number",
                    "system": false,
                    "required": false,
                    "unique": false,
                    "options": {
                        "min": 0,
                        "max": null
                    }
                },
                {
                    "id": "position",
                    "name": "position",
                    "type": "select",
                    "system": false,
                    "required": true,
                    "unique": false,
                    "options": {
                        "maxSelect": 1,
                        "values": [
                            "Server",
                            "Bartender", 
                            "Host",
                            "Busser",
                            "Chef",
                            "Prep Cook",
                            "Dishwasher",
                            "Manager"
                        ]
                    }
                },
                {
                    "id": "status",
                    "name": "status",
                    "type": "select",
                    "system": false,
                    "required": true,
                    "unique": false,
                    "options": {
                        "maxSelect": 1,
                        "values": [
                            "Scheduled",
                            "In Progress",
                            "Completed",
                            "Cancelled",
                            "No Show"
                        ]
                    }
                },
                {
                    "id": "notes",
                    "name": "notes",
                    "type": "text",
                    "system": false,
                    "required": false,
                    "unique": false,
                    "options": {
                        "min": null,
                        "max": 500,
                        "pattern": ""
                    }
                }
            ],
            "indexes": [],
            "listRule": "@request.auth.id != \"\"",
            "viewRule": "@request.auth.id != \"\"",
            "createRule": "@request.auth.role = \"Manager\"",
            "updateRule": "@request.auth.role = \"Manager\"",
            "deleteRule": "@request.auth.role = \"Manager\"",
            "options": {}
        };
        
        const createResponse = await fetch(`${PB_URL}/api/collections`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(collectionSchema)
        });
        
        if (createResponse.ok) {
            console.log('✅ Successfully created shifts_collection');
            const result = await createResponse.json();
            console.log('Collection ID:', result.id);
        } else {
            const error = await createResponse.text();
            console.error('❌ Failed to create collection:', error);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

createShiftsCollection();
