# PARC Portal Development Guide

## Project Overview

PARC Portal is a role-based restaurant management system built with SvelteKit and PocketBase. It provides specialized dashboards for different user roles (Managers and Servers) with appropriate permissions and functionality.

## Development Commands

### Frontend Commands
```bash
# Development
pnpm dev                    # Start development server
pnpm build                  # Build for production
pnpm preview               # Preview production build
pnpm check                 # Run type checking

# Testing
pnpm test                  # Run tests (when implemented)
pnpm test:unit            # Run unit tests
pnpm test:integration     # Run integration tests

# Code Quality
pnpm lint                 # Run ESLint
pnpm format               # Format code with Prettier
```

### PocketBase Commands
```bash
# Local PocketBase (if running locally)
./pocketbase serve        # Start local PocketBase instance
./pocketbase import       # Import collections
./pocketbase export       # Export collections
```

## Architecture

### Tech Stack
- **Frontend**: SvelteKit + TypeScript
- **Backend**: PocketBase (BaaS)
- **Database**: SQLite (via PocketBase)
- **Styling**: Tailwind CSS
- **Deployment**: Fly.io (PocketBase), TBD (Frontend)

### Key Directories
```
src/
├── lib/
│   ├── auth.js           # Authentication logic
│   ├── pocketbase.js     # PocketBase client
│   └── stores/           # Svelte stores
├── routes/               # SvelteKit routes
├── components/           # Reusable components
└── app.html             # HTML template
```

## User Roles and Permissions

### Manager Role
- Full CRUD access to all collections
- Dashboard with operational insights
- Inventory, staff, menu, vendor, event management
- Financial data access

### Server Role
- View-only access to schedules and menu
- Can update own shift status
- Limited to operational needs
- No administrative functions

## PocketBase Collections

### Collection IDs (Important for Code)
- **Users**: `_pb_users_auth_` (built-in auth)
- **Vendors**: `vendors_collection`
- **Inventory**: `inventory_collection`
- **Staff**: `staff_collection`
- **Shifts**: `shifts_collection`
- **Menu**: `menu_collection`
- **Events**: `events_collection`

### Field Naming Convention
All custom field IDs use the pattern: `{field_name}_field`
Example: `item_name_field`, `category_field`, etc.

## Environment Variables

```bash
# Required
VITE_POCKETBASE_URL=https://pocketbase-production-7050.up.railway.app/

# Optional (for development)
VITE_DEBUG=true
```

## Code Style Preferences

### Svelte/JavaScript
- Use `const` for constants, `let` for variables
- Prefer arrow functions for inline callbacks
- Use async/await over promises
- Component names in PascalCase
- File names in kebab-case

### Styling
- Tailwind CSS classes for styling
- Dark theme as primary (gray-900 to gray-800 gradient)
- Consistent color scheme:
  - Primary: Blue (blue-600)
  - Success: Green (green-600)
  - Warning: Orange/Yellow
  - Error: Red (red-600)
  - Manager role: Blue accent
  - Server role: Green accent

### Component Structure
```svelte
<script>
  // Imports
  // Props and variables
  // Reactive statements
  // Functions
  // Lifecycle hooks
</script>

<!-- Template -->

<style>
  /* Minimal custom styles */
</style>
```

## Database Schema Notes

### Important Relationships
- `inventory_collection.vendor_field` → `vendors_collection`
- `shifts_collection.staff_member` → `staff_collection`
- `staff_collection.user_id` → `_pb_users_auth_`

### Collection Rules (PocketBase)
Most collections use these rules:
- **List/View**: `""` (any authenticated user)
- **Create/Update**: `@request.auth.role = 'admin' || @request.auth.role = 'manager'`
- **Delete**: `@request.auth.role = 'admin'`

## Common Patterns

### Authentication Check
```javascript
import { authStore } from '$lib/auth.js';

onMount(() => {
  const unsubscribe = authStore.subscribe((auth) => {
    if (!auth.isLoggedIn && !auth.isLoading) {
      goto('/');
    }
    if (auth.role !== 'Manager') {
      goto('/dashboard');
    }
  });
  return unsubscribe;
});
```

### Data Loading
```javascript
import { collections, inventoryItems, loading } from '$lib/stores/collections.js';

// Load data
await collections.getInventoryItems();

// Use in template
{#if $loading.inventory}
  <div class="spinner">Loading...</div>
{:else}
  {#each $inventoryItems as item}
    <!-- item template -->
  {/each}
{/if}
```

### Error Handling
```javascript
try {
  await collections.createInventoryItem(data);
  // Success feedback
} catch (error) {
  console.error('Error:', error);
  // User-friendly error message
}
```

## Testing Strategy

### Unit Tests
- Test utility functions
- Test store logic
- Test component behavior

### Integration Tests
- Test authentication flow
- Test CRUD operations
- Test role-based access

### E2E Tests
- Test complete user workflows
- Test cross-browser compatibility

## Deployment

### PocketBase (Fly.io)
- Current instance: `https://pocketbase-production-7050.up.railway.app`
- Admin panel: Add `/_/` to URL
- Persistent storage via Fly.io volumes

### Frontend Deployment
- TBD - likely Vercel or Netlify
- Static site generation with SvelteKit adapter

## Security Considerations

### Client-Side
- Role-based route protection
- Input validation
- XSS prevention via Svelte's built-in escaping

### Server-Side (PocketBase)
- Authentication required for all operations
- Role-based collection rules
- Input sanitization and validation

## Performance Optimizations

### Current
- Lazy loading of routes
- Efficient Svelte reactivity
- Minimal bundle size

### Planned
- Image optimization
- Caching strategies
- Code splitting
- PWA capabilities

## Debugging Tips

### Common Issues
1. **Collection not found**: Check collection ID spelling
2. **Permission denied**: Verify user role and collection rules
3. **Field not found**: Check field ID format (`{name}_field`)
4. **Auth issues**: Check PocketBase connection and token validity

### Debug Tools
- Browser dev tools console
- PocketBase admin panel logs
- Network tab for API calls
- Svelte dev tools browser extension

## Feature Flags

### Current Features
- ✅ Role-based authentication
- ✅ Manager dashboard with full CRUD
- ✅ Server dashboard with limited access
- ✅ Inventory management
- ✅ Basic shift management

### Planned Features
- 🔄 Real-time updates
- 🔄 Advanced reporting
- 🔄 Mobile responsiveness improvements
- 🔄 Notification system
- 🔄 Bulk operations

## Contributing Guidelines

### Before Starting
1. Check AGENT.md for current project status
2. Review DASHBOARD_DOCUMENTATION.md for system overview
3. Ensure PocketBase collections are properly set up

### Development Workflow
1. Create feature branch
2. Implement changes with tests
3. Update documentation if needed
4. Test across different user roles
5. Submit for review

### Code Review Checklist
- [ ] Authentication/authorization working correctly
- [ ] Error handling implemented
- [ ] Loading states provided
- [ ] Mobile responsive
- [ ] Accessible (keyboard navigation, screen readers)
- [ ] Performance considerations
- [ ] Security best practices followed
