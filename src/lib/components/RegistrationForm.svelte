<script lang="ts">
	import { enhance } from '$app/forms';
	export let data = {};
	
	let name = data.name || '';
	let email = data.email || '';
	let error = data.error || '';
	let success = data.success || false;
	let message = data.message || '';
</script>

<form method="POST" use:enhance={() => {
		return {
			pending: ({ data, formElement }) => {
				console.log('Form submission pending');
				return {};
			}
		};
	}}>
	{#if error}
		<div class="text-red-500 text-sm mb-4">
			{error}
		</div>
	{/if}
	
	{#if success}
		<div class="text-green-500 text-sm mb-4">
			{message}
		</div>
	{/if}
	
	<div>
		<label for="name">Name</label>
		<input
			id="name"
			name="name"
			bind:value={name}
			class="w-full p-2 border rounded"
		/>
	</div>

	<div>
		<label for="email">Email</label>
		<input
			id="email"
			name="email"
			type="email"
			bind:value={email}
			class="w-full p-2 border rounded"
		/>
	</div>

	<button type="submit" class="bg-blue-500 text-white p-2 rounded">
		Register
	</button>
</form>