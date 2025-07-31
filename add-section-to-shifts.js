/**
 * Script to add section assignment field to existing shifts collection
 * Run this script after connecting to PocketBase admin
 */

// This would be used in PocketBase admin console or migration
const updateShiftsCollection = {
  "id": "shifts",
  "name": "shifts", 
  "schema": [
    // ... existing fields stay the same ...
    {
      "id": "assigned_section",
      "name": "assigned_section",
      "type": "relation",
      "system": false,
      "required": false,
      "unique": false,
      "options": {
        "collectionId": "sections",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["section_name", "section_code"]
      }
    }
    // Add this field to the existing schema
  ]
};

console.log("Add this field to your shifts collection:", JSON.stringify(updateShiftsCollection.schema[0], null, 2));
