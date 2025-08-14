import { error, json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const requestData = await request.json();
		console.log('🔍 Capture payment request:', requestData);
		
		const { payment_intent_id, tip_amount, final_amount } = requestData;

		// Validate required fields
		if (!payment_intent_id || final_amount === undefined) {
			console.error('❌ Missing required fields:', { payment_intent_id, final_amount });
			throw error(400, 'Missing payment intent ID or final amount');
		}

		// Import Stripe server-side using SvelteKit env
		const { env } = await import('$env/dynamic/private');
		const stripeKey = env.STRIPE_SECRET_KEY;
		if (!stripeKey) {
			throw new Error('STRIPE_SECRET_KEY environment variable is not set');
		}
		const stripe = (await import('stripe')).default(stripeKey);

		// Get the current payment intent to check capturable amount
		const currentPaymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
		console.log('🔍 Current payment intent:', {
			id: currentPaymentIntent.id,
			amount: currentPaymentIntent.amount,
			amount_capturable: currentPaymentIntent.amount_capturable,
			status: currentPaymentIntent.status
		});

		const finalAmountCents = Math.round(final_amount * 100);
		const amountToCapture = Math.min(finalAmountCents, currentPaymentIntent.amount_capturable);

		console.log('🔍 Capture details:', {
			requested_amount: finalAmountCents,
			amount_capturable: currentPaymentIntent.amount_capturable,
			amount_to_capture: amountToCapture
		});

		// Capture the payment with updated metadata
		const capturedPayment = await stripe.paymentIntents.capture(payment_intent_id, {
			amount_to_capture: amountToCapture,
			metadata: {
				tip_amount: tip_amount?.toString() || '0',
				final_amount: final_amount.toString()
			}
		});

		return json({
			payment_intent: capturedPayment,
			status: capturedPayment.status,
			amount_captured: capturedPayment.amount_received
		});
	} catch (err) {
		console.error('Error capturing payment:', err);
		
		if (err.type === 'StripeInvalidRequestError') {
			throw error(400, `Stripe error: ${err.message}`);
		}
		
		throw error(500, 'Internal server error capturing payment');
	}
}
