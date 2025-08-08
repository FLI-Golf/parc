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
pnpm test                  # Run all tests
pnpm test:unit            # Run unit tests
pnpm test:integration     # Run integration tests
pnpm test <pattern>       # Run specific test files (e.g., pnpm test vendors)

# Test Coverage by Collection
pnpm test table-updates   # Table status management tests
pnpm test tickets         # Order/ticket management tests  
pnpm test ticket-items    # Individual order item tests
pnpm test vendors         # Vendor management tests
pnpm test shifts          # Staff scheduling tests
pnpm test sections        # Restaurant layout tests

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
- Table management for assigned section
- Can help other sections (cross-section table management)
- Order taking and payment processing
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
- **Tickets**: `tickets_collection`
- **Ticket Items**: `ticket_items_collection`
- **Table Updates**: `table_updates_collection`
- **Sections**: `sections_collection`

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

## Key Server Dashboard Features

### Cross-Section Table Management
Servers can help other sections by clicking "Help Here" on any section:
- Tables from helping sections appear in the main "Your Tables" area
- Provides seamless management of all assigned and helping tables
- Visual distinction: assigned section tables (green), helping sections (blue)
- Reduces clicks and scrolling for efficient service
- Preferences persist across page refreshes via localStorage

### Enhanced Table Workflow Indicators
Comprehensive dot color system shows table status at a glance:
- 🟢 **Green**: Available for new orders
- 🟠 **Orange**: Order in progress (open)
- 🔵 **Blue**: Sent to kitchen / Being prepared
- 🔵 **Blue (slow pulse)**: Ready for pickup (items ready)
- 🟣 **Purple**: Served to guests
- 🟡 **Yellow**: Processing payment
- ⚫ **Gray**: Table being cleaned

### Advanced Menu Filtering System
Multi-select checkbox filtering with collapsible interface:
- **Collapsible design**: Saves screen space, collapsed by default
- **Multi-category selection**: Check multiple categories simultaneously (Dinner + Wine + Cocktails)
- **Default selections**: Dinner, Wine, Cocktails, Beer pre-selected for efficiency
- **Visual feedback**: Shows active filters with icons and names in header
- **Category mapping**: Smart mapping of subcategories to filter groups
- **Persistent preferences**: Filter state and expanded/collapsed preference saved
- **8 filter categories**: 🥐 Brunch, 🥗 Lunch, 🍽️ Dinner, 🍷 Wine, 🍸 Cocktails, 🍻 Happy Hour, 🍺 Beer, 🍰 Desserts

Note on dashboard behavior:
- **Server dashboard**: Defaults (Dinner, Wine, Cocktails, Beer) are applied unless you change them.
- **Manager dashboard**: When the detailed category chips are shown and you select one (e.g., Brunch, Lunch, Happy Hour, Desserts), that selection becomes the primary filter and overrides the defaults. This ensures those categories show results even if they’re not part of the default set.

### Table Click Behavior Preferences
Customizable click behavior to optimize workflow:
- **Direct Access (fewer clicks)**: Goes straight to order interface
- **Show Details First (more control)**: Shows table details modal first if orders exist
- Setting applies to both condensed and expanded views
- Preference saved in localStorage and persists across sessions

### Payment Flow Optimization
Streamlined payment processing:
- **Condensed View**: Direct payment processing with full interface
- **Expanded View**: Respects click behavior preference
- **Process Payment Button**: Takes user to detailed order interface (not modal)
- **Direct Payment Functions**: Handle cash/card payments in table details view
- All payment flows end in same detailed interface for consistency

### View Mode Persistence
User interface preferences are automatically saved:
- **Section Expansion**: Remembers collapsed/expanded state
- **Helping Sections**: Maintains list of sections user is helping
- **Click Behavior**: Saves Direct Access vs Show Details First preference
- All settings restored on page refresh for seamless experience

### Bar Orders Integration
For bartenders, Bar Orders section appears prominently after Today's Shifts:
- Shows pending drink orders with timing and priority
- Integrates with kitchen workflow for drink preparation
- Real-time updates when orders are sent to bar

### Voice Search Integration
Advanced speech recognition for efficient menu searching:
- **Voice Search Button**: Microphone icon appears in menu search bar when speech recognition is supported
- **Visual Feedback**: Button turns red with pulsing animation during recording
- **Cross-Browser Support**: Works with Web Speech API (Chrome, Edge, Safari)
- **Real-time Results**: Spoken queries instantly filter menu items
- **Hands-Free Operation**: Ideal for busy service environments
- **Debug Logging**: Comprehensive console logging for troubleshooting speech recognition issues
- **Usage**: Click microphone → speak search term → results appear automatically
- **Fallback**: Standard keyboard input always available as backup

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
- Test collection CRUD operations
- Test field validation (status, categories, types)
- Test role-based access controls

### Integration Tests
- Test authentication flow
- Test complete workflows (order lifecycle, shift scheduling)
- Test cross-collection relationships
- Test business logic and calculations
- Test real-time updates and notifications

### Collection Test Coverage
- **Table Updates**: Status transitions, capacity management
- **Tickets**: Order workflow, payment processing, kitchen integration
- **Ticket Items**: Kitchen station routing, course coordination
- **Vendors**: Onboarding workflow, performance tracking
- **Shifts**: Scheduling optimization, conflict detection
- **Sections**: Layout management, staffing requirements

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
- ✅ Shift management and scheduling
- ✅ Vendor management and onboarding
- ✅ Table status and updates tracking
- ✅ Order/ticket management system
- ✅ Kitchen workflow and item routing
- ✅ Restaurant section layout management
- ✅ Cross-section table management (helping other sections)
- ✅ Comprehensive test coverage for all collections

### Planned Features
- 🔄 Real-time updates
- 🔄 Advanced reporting
- 🔄 Mobile responsiveness improvements
- 🔄 Notification system
- 🔄 Bulk operations

## PocketBase Collections (Complete Schema)

The system uses the following collections in PocketBase:

### 1. Users Collection (Built-in Auth)
- **ID**: `_pb_users_auth_`
- **Type**: Auth collection
- **Fields**:
  - `name` (text): User's full name
  - `email` (email): Login email
  - `avatar` (file): Profile picture
  - `role` (select): User role (`Manager`, `Server`)
  - `phone` (text): Contact phone number

### 2. Vendors Collection
- **ID**: `vendors_collection`
- **Name**: `vendors`
- **Fields**:
  - `name` (text): Vendor company name
  - `contact_person` (text): Primary contact
  - `email` (email): Contact email
  - `phone` (text): Contact phone
  - `address` (text): Business address
  - `category` (select): Vendor type
  - `payment_terms` (text): Payment arrangements
  - `status` (select): Active/Inactive/Pending
  - `notes` (text): Additional notes

### 3. Inventory Items Collection
- **ID**: `inventory_collection`
- **Name**: `inventory_items`
- **Fields**:
  - `name` (text): Item name
  - `description` (text): Item description
  - `category` (select): Item category
  - `unit` (select): Measurement unit
  - `current_stock` (number): Current quantity
  - `min_stock_level` (number): Minimum stock threshold
  - `max_stock_level` (number): Maximum stock capacity
  - `cost_per_unit` (number): Cost per unit
  - `vendor_field` (relation): Link to vendor
  - `expiry_date` (date): Expiration date

### 4. Staff Collection
- **ID**: `staff_collection`
- **Name**: `staff`
- **Fields**:
  - `first_name` (text): First name
  - `last_name` (text): Last name
  - `email` (email): Work email
  - `phone` (text): Phone number
  - `position` (select): Job position
  - `hourly_rate` (number): Pay rate
  - `hire_date` (date): Employment start date
  - `status` (select): Employment status
  - `user_id` (relation): Link to user account

### 5. Shifts Collection
- **ID**: `shifts_collection`
- **Name**: `shifts`
- **Fields**:
  - `staff_member` (relation): Link to staff member
  - `shift_date` (date): Work date
  - `start_time` (text): Start time (HH:MM format)
  - `end_time` (text): End time (HH:MM format)
  - `break_duration` (number): Break time in minutes
  - `position` (select): Position for this shift
  - `status` (select): Shift status
  - `notes` (text): Shift notes

### 6. Menu Items Collection
- **ID**: `menu_collection`
- **Name**: `menu_items`
- **Fields**:
  - `name` (text): Menu item name
  - `description` (text): Item description
  - `category` (select): Menu category
  - `price` (number): Selling price
  - `cost` (number): Cost to make
  - `ingredients` (text): Ingredient list
  - `allergens` (select): Allergen information
  - `preparation_time` (number): Prep time in minutes
  - `available` (bool): Availability status
  - `image` (file): Item photo

### 7. Events Collection
- **ID**: `events_collection`
- **Name**: `events`
- **Fields**:
  - `name` (text): Event name
  - `description` (text): Event description
  - `event_type` (select): Type of event
  - `event_date` (date): Event date
  - `start_time` (text): Start time
  - `end_time` (text): End time
  - `guest_count` (number): Expected guests
  - `contact_name` (text): Client contact
  - `contact_email` (email): Client email
  - `contact_phone` (text): Client phone
  - `status` (select): Event status
  - `special_requirements` (text): Special needs
  - `estimated_revenue` (number): Expected revenue

### 8. Tables Collection
- **ID**: `tables_collection`
- **Name**: `tables`
- **Fields**:
  - `table_number_field` (text): Table identifier
  - `section_field` (relation): Link to section
  - `seats_field` (number): Seating capacity
  - `status_field` (text): Current status

### 9. Table Updates Collection
- **ID**: `table_updates_collection`
- **Name**: `table_updates`
- **Fields**:
  - Status transitions and table management

### 10. Tickets Collection
- **ID**: `tickets_collection`
- **Name**: `tickets`
- **Fields**:
  - Order/ticket management with kitchen workflow

### 11. Ticket Items Collection
- **ID**: `ticket_items_collection`
- **Name**: `ticket_items`
- **Fields**:
  - Individual order items with routing

### 12. Sections Collection
- **ID**: `sections_collection`
- **Name**: `sections`
- **Fields**:
  - Restaurant layout and section management

### 13. Payments Collection
- **ID**: `payments_collection`
- **Name**: `payments`
- **Fields**:
  - Payment processing with Stripe integration

### 14. Completed Orders Collection
- **ID**: `completed_orders`
- **Name**: `completed_orders`
- **Fields**:
  - Historical order records

## User Role Permissions

### Manager Role
**Full administrative access to all restaurant operations**

**Capabilities**:
- ✅ View comprehensive dashboard with key metrics
- ✅ Full CRUD operations on all collections
- ✅ Inventory management and low stock alerts
- ✅ Staff management and scheduling
- ✅ Menu item management
- ✅ Vendor relationship management
- ✅ Event planning and management
- ✅ Real-time operational insights

**Dashboard Features**:
- **Overview Tab**: Key metrics, low stock alerts, today's schedule
- **Inventory Tab**: Full inventory management with CRUD operations
- **Staff Tab**: Employee management and records
- **Shifts Tab**: Schedule management and shift assignments
- **Menu Tab**: Menu item management and pricing
- **Vendors Tab**: Supplier relationship management
- **Events Tab**: Event booking and management

### Server Role
**Limited access focused on daily operational needs**

**Capabilities**:
- ✅ View assigned shifts and schedule
- ✅ Confirm shift attendance
- ✅ Mark shifts as completed
- ✅ Access menu reference with allergen information
- ✅ View and update basic profile information
- ✅ Cross-section table management (helping other sections)
- ✅ Order taking and payment processing
- ❌ No access to administrative functions
- ❌ No CRUD operations on business data
- ❌ No access to financial information

**Dashboard Features**:
- **Today's Shifts**: Current day schedule and shift management
- **My Schedule**: Upcoming shift assignments
- **Menu Reference**: Menu items with allergen and prep time info
- **My Profile**: Personal information management
- **Table Management**: Order workflow and payment processing

## Advanced Menu Filtering System

The server dashboard features an advanced, multi-select checkbox filtering system for efficient menu browsing:

### Multi-Select Categories
- **🥐 Brunch** - Brunch items and morning specials
- **🥗 Lunch** - Lunch menu items  
- **🍽️ Dinner** - Dinner menu items (default selected)
- **🍷 Wine** - All wine varieties (default selected)
- **🍸 Cocktails** - Signature and classic cocktails (default selected)
- **🍻 Happy Hour** - Happy hour menu items
- **🍺 Beer** - Draft and bottled beer (default selected)
- **🍰 Desserts** - Dessert items and sweet treats

### Key Features
- **Collapsible design**: Saves screen space, collapsed by default
- **Multi-category selection**: Check multiple categories simultaneously (Dinner + Wine + Cocktails)
- **Default selections**: Dinner, Wine, Cocktails, Beer pre-selected for efficiency
- **Visual feedback**: Shows active filters with icons and names in header
- **Category mapping**: Smart mapping of subcategories to filter groups
- **Persistent preferences**: Filter state and expanded/collapsed preference saved
- **8 filter categories**: Comprehensive coverage of menu sections

### Technical Implementation

#### State Management
```javascript
let selectedCategories = {
    brunch: false,
    lunch: false, 
    dinner: true,    // Default checked
    wine: true,      // Default checked
    cocktails: true, // Default checked
    happy_hour: false,
    beer: true,      // Default checked
    desserts: false
};
let showFilters = false; // Collapsed by default
```

#### Menu Item Mapping
The filtering logic maps menu item subcategories to filter categories:
- **Wine filter**: Includes wine_red, wine_white, wine_sparkling
- **Cocktails filter**: Includes cocktail_classic, cocktail_signature
- **Beer filter**: Includes beer_draft, beer_bottle
- **Desserts filter**: Includes dessert items and specific subcategories

#### Persistence
Filter preferences automatically save to localStorage:
- `selectedCategories` - Which filters are active
- `showFilters` - Whether filter section is expanded/collapsed

### Usage Examples
1. **Taking dinner order with wine**: Default state already optimized ✅
2. **Happy hour service**: Uncheck Dinner, check Happy Hour
3. **Dessert service**: Uncheck Dinner, check Desserts, keep Wine/Cocktails
4. **Lunch service**: Uncheck Dinner, check Lunch, adjust beverage filters

## Authentication Flow

### Login Process
1. User enters email and password on login page
2. System authenticates with PocketBase
3. User role is determined from the auth response
4. User is redirected to appropriate dashboard:
   - Managers → `/dashboard/manager`
   - Servers → `/dashboard/server`
   - Unknown roles → `/dashboard` (fallback)

### Session Management
- Authentication state managed via Svelte stores
- PocketBase handles session persistence
- Automatic logout on invalid sessions
- Role-based route protection

## API Integration

### Collection Service Functions
Located in `src/lib/stores/collections.js`

**Available Operations for each collection**:
- `get{Collection}()` - Fetch all records
- `create{Collection}(data)` - Create new record
- `update{Collection}(id, data)` - Update existing record
- `delete{Collection}(id)` - Delete record

**Example Usage**:
```javascript
import { collections } from '$lib/stores/collections.js';

// Fetch inventory items
await collections.getInventoryItems();

// Create new inventory item
await collections.createInventoryItem({
  name: 'Tomatoes',
  category: 'food',
  unit: 'kg',
  current_stock: 50,
  min_stock_level: 10
});

// Update stock level
await collections.updateInventoryItem('item_id', {
  current_stock: 30
});
```

## Deployment Architecture

### PocketBase Instance
- **URL**: `https://pocketbase-production-7050.up.railway.app`
- **Admin Panel**: `https://pocketbase-production-7050.up.railway.app/_/`
- **Hosted on**: Fly.io
- **Database**: Persistent SQLite with volume storage

### Frontend Deployment
- Built with SvelteKit
- Static assets optimized for production
- Environment variables for PocketBase URL configuration

## Contributing Guidelines

### Before Starting
1. Check AGENT.md for current project status and system overview
2. Ensure PocketBase collections are properly set up

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
