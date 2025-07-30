<script lang="ts">
	import { enhance } from '$app/forms';
	import { userSchema } from '$lib/forms/userSchema';
	export let data = {};
	
	let name = data.name || '';
	let email = data.email || '';
	let username = '';
	let password = '';
	let passwordConfirm = '';
	let phone = '';
	let avatar: File | null = null;
	let role = 'Server';
	let emailVisibility = true;
	let error = data.error || '';
	let success = data.success || false;
	let message = data.message || '';
	let isSubmitting = false;

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			avatar = target.files[0];
		}
	}
</script>

<form method="POST" use:enhance={() => {
		// Set submitting state
		isSubmitting = true;
		console.log('Form submission pending');
		
		// Return nothing to use the default behavior
		// The form will be reset and updated automatically
	}} enctype="multipart/form-data">
	{#if error}
		<div class="text-red-400 bg-red-900/50 p-3 rounded-lg mb-4 text-sm">
			{error}
		</div>
	{/if}
	
	{#if success}
		<div class="text-green-400 bg-green-900/50 p-3 rounded-lg mb-4 text-sm">
			{message}
		</div>
	{/if}
	
	<div class="mb-4">
		<label for="name" class="block text-sm font-medium text-gray-300 mb-1">
			Name
		</label>
		<input
			id="name"
			name="name"
			bind:value={name}
			class="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<div class="mb-4">
		<label for="username" class="block text-sm font-medium text-gray-300 mb-1">
			Username
		</label>
		<input
			id="username"
			name="username"
			bind:value={username}
			class="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<div class="mb-4">
		<label for="email" class="block text-sm font-medium text-gray-300 mb-1">
			Email
		</label>
		<input
			id="email"
			name="email"
			type="email"
			bind:value={email}
			class="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<div class="mb-4">
		<label for="password" class="block text-sm font-medium text-gray-300 mb-1">
			Password
		</label>
		<input
			id="password"
			name="password"
			type="password"
			bind:value={password}
			class="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<div class="mb-4">
		<label for="passwordConfirm" class="block text-sm font-medium text-gray-300 mb-1">
			Confirm Password
		</label>
		<input
			id="passwordConfirm"
			name="passwordConfirm"
			type="password"
			bind:value={passwordConfirm}
			class="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<div class="mb-4">
		<label for="phone" class="block text-sm font-medium text-gray-300 mb-1">
			Phone (optional)
		</label>
		<input
			id="phone"
			name="phone"
			type="tel"
			bind:value={phone}
			class="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<div class="mb-4">
		<label for="avatar" class="block text-sm font-medium text-gray-300 mb-1">
			Avatar (optional)
		</label>
		<input
			id="avatar"
			name="avatar"
			type="file"
			accept="image/*"
			on:change={handleFileChange}
			class="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-md text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
		/>
	</div>

	<!-- Role is set to Server by default and not user-selectable -->
	<input type="hidden" name="role" value="Server" />

	<div class="mb-6">
		<label class="flex items-center">
			<input
				type="checkbox"
				name="emailVisibility"
				bind:checked={emailVisibility}
				class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
			/>
			<span class="ml-2 block text-sm text-gray-300">
				Make my email visible to other users
			</span>
		</label>
	</div>

	<button
		type="submit"
		class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
		disabled={isSubmitting}
	>
		{isSubmitting ? 'Registering...' : 'Register'}
	</button>
</form>