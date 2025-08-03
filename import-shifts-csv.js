import PocketBase from 'pocketbase';
import fs from 'fs';

const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

async function importShiftsFromCSV() {
  try {
    console.log('Reading shifts CSV data...');
    
    // Read the CSV file
    const csvData = fs.readFileSync('./static/sample-data/shifts-with-sections.csv', 'utf8');
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    
    console.log('CSV Headers:', headers);
    console.log('Data rows:', lines.length - 1);
    
    // Parse CSV data
    const shifts = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const shift = {
        staff_member: values[0],
        assigned_section: values[1], 
        shift_date: values[2],
        start_time: values[3],
        end_time: values[4],
        break_duration: parseInt(values[5]),
        position: values[6],
        status: values[7],
        notes: values[8]
      };
      shifts.push(shift);
    }
    
    console.log('\nParsed shifts data:');
    shifts.forEach((shift, index) => {
      console.log(`${index + 1}. ${shift.staff_member} - ${shift.position} on ${shift.shift_date}`);
    });
    
    console.log('\n=== Instructions for Manual Import ===');
    console.log('Since we cannot authenticate as admin, please:');
    console.log('1. Go to: https://pocketbase-production-7050.up.railway.app/_/');
    console.log('2. Create the collections using the schema files generated');
    console.log('3. Import this shifts data manually');
    
    // Create a JSON file with the shifts data for easy import
    fs.writeFileSync('./shifts_import_data.json', JSON.stringify(shifts, null, 2));
    console.log('\nCreated shifts_import_data.json for easy import');
    
    // Also create a simplified format that matches PocketBase import format
    const importFormat = {
      "shifts_collection": shifts
    };
    fs.writeFileSync('./shifts_pocketbase_import.json', JSON.stringify(importFormat, null, 2));
    console.log('Created shifts_pocketbase_import.json for PocketBase import');

  } catch (error) {
    console.error('Error processing CSV:', error);
  }
}

importShiftsFromCSV();
