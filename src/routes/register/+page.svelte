<script>
	import RegistrationForm from '$lib/components/RegistrationForm.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
</script>

<div class="max-w-md mx-auto p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700">
	<div class="flex justify-end mb-4">
		<ThemeToggle />
	</div>
	
	<!-- Breadcrumbs -->
	<nav class="text-sm mb-4">
		<ol class="list-none p-0 inline-flex">
			<li class="flex items-center">
				<a href="/" class="text-blue-400 hover:text-blue-300">Home</a>
				<span class="mx-2 text-gray-500">/</span>
			</li>
			<li class="flex items-center text-gray-300">
				Register
			</li>
		</ol>
	</nav>
	
	<h1 class="text-2xl font-bold mb-4 text-white">Register</h1>
	<RegistrationForm />
</div>