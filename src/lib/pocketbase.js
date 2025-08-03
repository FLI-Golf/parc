import PocketBase from 'pocketbase';

// Initialize PocketBase client with your Fly.io instance URL
const pb = new PocketBase('https://pocketbase-production-7050.up.railway.app');

export default pb;