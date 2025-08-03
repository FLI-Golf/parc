// Simple vendors collection schema
const vendorsSchema = {
  "id": "vendors_collection",
  "name": "vendors",
  "type": "base",
  "system": false,
  "schema": [
    {
      "id": "vendor_name_field",
      "name": "vendor_name_field", 
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
      "id": "contact_email_field",
      "name": "contact_email_field",
      "type": "email",
      "system": false,
      "required": false,
      "unique": false,
      "options": {
        "exceptDomains": null,
        "onlyDomains": null
      }
    },
    {
      "id": "contact_phone_field",
      "name": "contact_phone_field",
      "type": "text",
      "system": false,
      "required": false,
      "unique": false,
      "options": {
        "min": null,
        "max": null,
        "pattern": ""
      }
    },
    {
      "id": "address_field",
      "name": "address_field",
      "type": "text",
      "system": false,
      "required": false,
      "unique": false,
      "options": {
        "min": null,
        "max": null,
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

import fs from 'fs';
fs.writeFileSync('vendors_collection_schema.json', JSON.stringify(vendorsSchema, null, 2));
console.log('Created vendors_collection_schema.json');
