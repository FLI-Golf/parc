# PocketBase Deployment on Fly.io

Your PocketBase instance is now deployed and running at:
https://pocketbase-app-1753896437.fly.dev/

## Accessing the Admin Panel

1. Visit https://pocketbase-app-1753896437.fly.dev/_/
2. Create your first admin account (superuser)
3. Log in with your admin credentials

## Importing Collections

To import collections into your PocketBase instance:

1. **Using the Admin UI (Recommended for beginners):**
   - Go to the Admin Panel
   - Navigate to "Collections"
   - Click "Import collection"
   - Paste the JSON from `sample_collections.json` or create your own collections

2. **Using the PocketBase CLI (Advanced):**
   ```bash
   # First, download the PocketBase CLI for your system
   # Then use the following command:
   pocketbase import collections.json --dir ./pb_data
   ```

3. **Using the REST API:**
   ```javascript
   // Example using JavaScript/Node.js
   const PocketBase = require('pocketbase');
   
   const pb = new PocketBase('https://pocketbase-app-1753896437.fly.dev');
   
   // Authenticate as admin
   await pb.admins.authWithPassword('your_admin_email', 'your_admin_password');
   
   // Import collections from the sample_collections.json file
   const collections = require('./sample_collections.json');
   
   for (const collection of collections) {
     await pb.collections.create(collection);
   }
   ```

## Sample Collections

The `sample_collections.json` file contains two sample collections:
1. **Users** - An auth collection for user management
2. **Posts** - A base collection for blog posts with a relation to users

## Environment Variables

Update your `.env` file with the correct PocketBase URL:

```
DATABASE_URL=file:local.db
POCKETBASE_URL=https://pocketbase-app-1753896437.fly.dev
PUBLIC_POCKETBASE_URL=https://pocketbase-app-1753896437.fly.dev
POCKETBASE_EMAIL=ddinsmore8@gmail.com
POCKETBASE_PASSWORD=your_secure_password
```

## Connecting from Your SvelteKit App

In your SvelteKit application, you can connect to PocketBase using the JavaScript SDK:

```javascript
// src/lib/pocketbase.js
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pocketbase-app-1753896437.fly.dev');

export default pb;
```

Then use it in your components or server-side code:

```javascript
// Example usage in a Svelte component
import pb from '$lib/pocketbase';

// List records
const records = await pb.collection('posts').getFullList();

// Create a new record
const newRecord = await pb.collection('posts').create({
  title: 'Hello World',
  content: 'This is my first post',
  author: 'user_id'
});
```

## Persistent Storage

Your PocketBase data is now stored persistently on Fly.io volumes. Even if the machines restart, your data will remain intact.

## Troubleshooting

If you encounter any issues:

1. Check the machine status: `fly status`
2. View logs: `fly logs`
3. Restart machines if needed: `fly machine restart [machine_id]`

For more information, refer to the [PocketBase documentation](https://pocketbase.io/docs/).