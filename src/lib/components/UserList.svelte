<script lang="ts">
  import { onMount } from 'svelte';
  import { getAllUsers, getUsersByRole, searchUsersByName, getVerifiedUsers } from '$lib/utils/userQueries';
  import type { User } from '$lib/utils/userQueries';

  let users: User[] = [];
  let loading = false;
  let error: string | null = null;
  let searchQuery = '';
  let selectedRole: 'All' | 'owner' | 'manager' | 'server' | 'host' | 'bartender' | 'busser' | 'chef' | 'kitchen_prep' | 'dishwasher' = 'All';
  let showVerifiedOnly = false;

  // Load users on component mount
  onMount(async () => {
    await loadUsers();
  });

  // Load users based on current filters
  async function loadUsers() {
    loading = true;
    error = null;

    try {
      if (searchQuery) {
        // Search by name if query exists
        users = await searchUsersByName(searchQuery);
      } else if (selectedRole !== 'All') {
        // Filter by role
        users = await getUsersByRole(selectedRole);
      } else if (showVerifiedOnly) {
        // Show only verified users
        users = await getVerifiedUsers();
      } else {
        // Show all users
        users = await getAllUsers();
      }
    } catch (err) {
      console.error('Error loading users:', err);
      error = 'Failed to load users. Please try again.';
    } finally {
      loading = false;
    }
  }

  // Handle search form submission
  function handleSearch() {
    loadUsers();
  }

  // Reset filters
  function resetFilters() {
    searchQuery = '';
    selectedRole = 'All';
    showVerifiedOnly = false;
    loadUsers();
  }

  // Format date for display
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
</script>

<div class="user-list-component">
  <h2 class="text-2xl font-bold mb-6">User Management</h2>

  <!-- Filters -->
  <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Search -->
      <div>
        <label for="search" class="block text-sm font-medium text-gray-300 mb-1">
          Search by Name
        </label>
        <input
          id="search"
          bind:value={searchQuery}
          placeholder="Enter name..."
          class="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <!-- Role Filter -->
      <div>
        <label for="role" class="block text-sm font-medium text-gray-300 mb-1">
          Filter by Role
        </label>
        <select
          id="role"
          bind:value={selectedRole}
          class="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="All">All Roles</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="server">Server</option>
          <option value="host">Host</option>
          <option value="bartender">Bartender</option>
          <option value="busser">Busser</option>
          <option value="chef">Chef</option>
          <option value="kitchen_prep">Kitchen Prep</option>
          <option value="dishwasher">Dishwasher</option>
        </select>
      </div>

      <!-- Verified Only Checkbox -->
      <div class="flex items-end">
        <label class="flex items-center">
          <input
            type="checkbox"
            bind:checked={showVerifiedOnly}
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700"
          />
          <span class="ml-2 block text-sm text-gray-300">
            Verified Users Only
          </span>
        </label>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-wrap gap-3 mt-4">
      <button
        on:click={handleSearch}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm font-medium"
      >
        Apply Filters
      </button>
      <button
        on:click={resetFilters}
        class="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
      >
        Reset Filters
      </button>
    </div>
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
      {error}
    </div>
  {/if}

  <!-- Loading Indicator -->
  {#if loading}
    <div class="flex justify-center items-center h-32">
      <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  {:else}
    <!-- User Count -->
    <div class="mb-4">
      <p class="text-gray-400">
        Showing {users.length} user{users.length !== 1 ? 's' : ''}
      </p>
    </div>

    <!-- User List -->
    {#if users.length > 0}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each users as user}
          <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-4 hover:bg-gray-800 transition-colors">
            <div class="flex items-start space-x-3">
              {#if user.avatar}
                <img
                  src={`https://pocketbase-production-7050.up.railway.app/api/files/_pb_users_auth_/${user.id}/${user.avatar}`}
                  alt={user.name}
                  class="w-12 h-12 rounded-full object-cover"
                />
              {:else}
                <div class="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                  <span class="font-medium">{user.name?.charAt(0) || user.email?.charAt(0) || 'U'}</span>
                </div>
              {/if}
              <div class="flex-1 min-w-0">
                <h3 class="font-medium text-white truncate">{user.name || 'Unnamed User'}</h3>
                <p class="text-sm text-gray-400 truncate">{user.email}</p>
                <div class="flex items-center mt-1">
                  <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'manager' || user.role === 'owner' 
                      ? 'bg-blue-900/50 text-blue-300' 
                      : 'bg-green-900/50 text-green-300'
                  }`}>
                    {user.role}
                  </span>
                  {#if user.verified}
                    <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-900/50 text-purple-300">
                      Verified
                    </span>
                  {/if}
                </div>
              </div>
            </div>
            <div class="mt-3 text-xs text-gray-500">
              Joined: {formatDate(user.created)}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- No Users Found -->
      <div class="text-center py-12">
        <div class="mx-auto w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.644 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-200 mb-1">No users found</h3>
        <p class="text-gray-500">Try adjusting your filters or search query</p>
      </div>
    {/if}
  {/if}
</div>