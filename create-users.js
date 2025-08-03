import PocketBase from 'pocketbase';
import fs from 'fs';
import csv from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

// Admin login
await pb.admins.authWithPassword('admin@parcbistro.com', 'parcmanager123');

const staffData = [];
const userIds = {};

// Read staff CSV
fs.createReadStream('static/sample-data/staff.csv')
  .pipe(csv())
  .on('data', (data) => staffData.push(data))
  .on('end', async () => {
    console.log('Creating users for staff members...');
    
    for (const staff of staffData) {
      try {
        // Create user account
        const userData = {
          email: staff.email,
          password: 'temp123', // Temporary password
          passwordConfirm: 'temp123',
          name: `${staff.first_name} ${staff.last_name}`,
          role: staff.position === 'manager' ? 'Manager' : 'Server'
        };
        
        const user = await pb.collection('users').create(userData);
        userIds[staff.email] = user.id;
        
        console.log(`Created user: ${staff.email} -> ${user.id}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error creating user for ${staff.email}:`, error);
      }
    }
    
    // Update staff CSV with user IDs
    const updatedStaffData = staffData.map(staff => ({
      ...staff,
      user_id: userIds[staff.email] || ''
    }));
    
    const staffWriter = createObjectCsvWriter({
      path: 'static/sample-data/staff-with-users.csv',
      header: [
        {id: 'user_id', title: 'user_id'},
        {id: 'first_name', title: 'first_name'},
        {id: 'last_name', title: 'last_name'},
        {id: 'email', title: 'email'},
        {id: 'phone', title: 'phone'},
        {id: 'position', title: 'position'},
        {id: 'hourly_rate', title: 'hourly_rate'},
        {id: 'hire_date', title: 'hire_date'},
        {id: 'status', title: 'status'}
      ]
    });
    
    await staffWriter.writeRecords(updatedStaffData);
    console.log('Updated staff CSV with user IDs created');
    
    // Save user mapping for shifts update
    fs.writeFileSync('user-mapping.json', JSON.stringify(userIds, null, 2));
    console.log('User mapping saved to user-mapping.json');
  });
