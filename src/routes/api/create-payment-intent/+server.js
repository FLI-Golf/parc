import { error, json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { 
			amount, 
			currency, 
			table_id, 
			ticket_id, 
			description,
			subtotal,
			tip_amount,
			tip_percentage,
			capture_method
		} = await request.json();

		// Validate required fields
		if (!amount || !currency || !table_id) {
			throw error(400, 'Missing required payment data');
		}

		// Import Stripe server-side using SvelteKit env (works in dev and prod)
		const { env } = await import('$env/dynamic/private');
		console.log('🔑 Checking Stripe secret key:', env.STRIPE_SECRET_KEY ? 'EXISTS' : 'MISSING');
		console.log('🔍 Debug: Full environment check:', {
			NODE_ENV: env.NODE_ENV,
			STRIPE_SECRET_KEY_LENGTH: env.STRIPE_SECRET_KEY?.length || 0,
			STRIPE_SECRET_KEY_PREFIX: env.STRIPE_SECRET_KEY?.substring(0, 10) || 'NONE',
		});
		
		// Require Stripe secret key to be set in environment
		const stripeKey = env.STRIPE_SECRET_KEY;
		if (!stripeKey) {
			throw new Error('STRIPE_SECRET_KEY environment variable is not set');
		}
		const stripe = (await import('stripe')).default(stripeKey);

		// Create payment intent with optional manual capture
		const paymentIntentData = {
			amount: Math.round(amount), // Ensure it's an integer (cents)
			currency: currency.toLowerCase(),
			metadata: {
				table_id: table_id.toString(),
				ticket_id: ticket_id?.toString() || '',
				description: description || '',
				subtotal: subtotal?.toString() || '',
				tip_amount: tip_amount?.toString() || '0',
				tip_percentage: tip_percentage?.toString() || ''
			},
			automatic_payment_methods: {
				enabled: true
			}
		};

		// Add capture method if specified (for authorize-only flow)
		if (capture_method) {
			paymentIntentData.capture_method = capture_method;
		}

		const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

		return json({
			client_secret: paymentIntent.client_secret,
			payment_intent_id: paymentIntent.id
		});
	} catch (err) {
		console.error('Error creating payment intent:', err);
		
		if (err.type === 'StripeInvalidRequestError') {
			throw error(400, `Stripe error: ${err.message}`);
		}
		
		throw error(500, 'Internal server error creating payment intent');
	}
}
