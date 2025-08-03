/**
 * Script to check PocketBase status and available collections
 */

const PB_URL = 'https://pocketbase-production-7050.up.railway.app';

async function checkPocketBaseStatus() {
    try {
        console.log('Checking PocketBase instance...');
        
        // Test basic connectivity
        const healthResponse = await fetch(`${PB_URL}/api/health`);
        console.log('Health check:', healthResponse.status);
        
        // Try to get collections (this will return 401 but confirms the API is working)
        const collectionsResponse = await fetch(`${PB_URL}/api/collections`);
        console.log('Collections endpoint:', collectionsResponse.status);
        
        if (collectionsResponse.status === 401) {
            console.log('✅ PocketBase is running but requires admin auth');
        }
        
        // Check if this is a fresh install (no admin created yet)
        const adminResponse = await fetch(`${PB_URL}/api/admins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'test@test.com',
                password: 'test123456'
            })
        });
        
        console.log('Admin creation test:', adminResponse.status);
        
        if (adminResponse.status === 400) {
            const errorData = await adminResponse.json();
            console.log('Admin creation error:', errorData);
            
            if (errorData.message?.includes('admins already')) {
                console.log('✅ Admin account already exists');
                console.log('❌ Your credentials might be incorrect');
            }
        }
        
    } catch (error) {
        console.error('Error checking PocketBase:', error.message);
    }
}

checkPocketBaseStatus();
