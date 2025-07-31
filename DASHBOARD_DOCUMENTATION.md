# PARC Portal Dashboard Documentation

## Overview

The PARC Portal is a role-based restaurant management system built with SvelteKit and PocketBase. It provides different dashboard experiences for Managers and Servers, with tailored functionality for each role.

## Architecture

### Tech Stack
- **Frontend**: SvelteKit
- **Backend**: PocketBase (hosted on Fly.io)
- **Database**: SQLite (via PocketBase)
- **Styling**: Tailwind CSS
- **Authentication**: PocketBase Auth

### Project Structure
```
src/
├── lib/
│   ├── auth.js                 # Authentication store and functions
│   ├── pocketbase.js          # PocketBase client configuration
│   └── stores/
│       └── collections.js     # Collection data stores and CRUD operations
├── routes/
│   ├── +page.svelte          # Login page
│   └── dashboard/
│       ├── +page.svelte      # Dashboard router (redirects by role)
│       ├── manager/
│       │   └── +page.svelte  # Manager dashboard
│       └── server/
│           └── +page.svelte  # Server dashboard
└── app.html
```

## PocketBase Collections

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

## User Roles and Permissions

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
- ❌ No access to administrative functions
- ❌ No CRUD operations on business data
- ❌ No access to financial information

**Dashboard Features**:
- **Today's Shifts**: Current day schedule and shift management
- **My Schedule**: Upcoming shift assignments
- **Menu Reference**: Menu items with allergen and prep time info
- **My Profile**: Personal information management

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

## Security Considerations

### Access Control
- Role-based access control (RBAC) implemented
- PocketBase collection rules enforce permissions:
  - Create/Update/Delete: Requires `Manager` role
  - Read: Available to authenticated users
- Client-side route protection prevents unauthorized access

### Data Protection
- All API calls authenticated via PocketBase auth tokens
- Sensitive information (costs, rates) only visible to managers
- User data isolated by authentication context

## Deployment

### PocketBase Instance
- **URL**: `https://pocketbase-app-1753896437.fly.dev`
- **Admin Panel**: `https://pocketbase-app-1753896437.fly.dev/_/`
- **Hosted on**: Fly.io
- **Database**: Persistent SQLite with volume storage

### Frontend Deployment
- Built with SvelteKit
- Static assets optimized for production
- Environment variables for PocketBase URL configuration

## Development Setup

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Local Development
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

### Environment Configuration
Create `.env` file:
```
VITE_POCKETBASE_URL=https://pocketbase-app-1753896437.fly.dev/
```

## Future Enhancements

### Planned Features
1. **Real-time Updates**: WebSocket integration for live data
2. **Reporting Dashboard**: Advanced analytics and reports
3. **Mobile App**: React Native or Flutter companion app
4. **Notification System**: Email/SMS alerts for critical events
5. **Integration APIs**: Third-party service integrations
6. **Advanced Scheduling**: Automated shift optimization
7. **Financial Management**: Cost analysis and profit tracking

### Technical Improvements
1. **Performance**: Implement caching and lazy loading
2. **Testing**: Unit and integration test coverage
3. **Monitoring**: Error tracking and performance monitoring
4. **Backup**: Automated database backup system
5. **Scaling**: Multi-tenant architecture support

## Support and Maintenance

### Common Issues
1. **Authentication Errors**: Check PocketBase connection and user roles
2. **Data Loading Issues**: Verify collection IDs and field names
3. **Permission Denied**: Confirm user has appropriate role
4. **Network Errors**: Check PocketBase instance availability

### Troubleshooting
- Check browser console for error messages
- Verify PocketBase admin panel accessibility
- Confirm collection schema matches code expectations
- Test authentication flow with known good credentials

### Contact Information
For technical support or feature requests, contact the development team.
