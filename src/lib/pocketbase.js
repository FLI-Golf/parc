import PocketBase from 'pocketbase';

// Initialize PocketBase client using env, fallback to production URL
const base = (import.meta.env.VITE_POCKETBASE_URL ?? 'https://pocketbase-production-7050.up.railway.app/').replace(/\/+$/, '');
const pb = new PocketBase(base);

export default pb;