# PARC Portal - Restaurant Management System

A role-based restaurant management system built with SvelteKit and PocketBase. PARC Portal provides specialized dashboards for different user roles with appropriate permissions and functionality.

## 🎯 System Overview

PARC Portal is designed for restaurants to manage daily operations efficiently with role-based access control:

- **Managers**: Full administrative access to all restaurant operations
- **Servers**: Limited access focused on daily operational needs
- **Kitchen Staff**: Order management and kitchen workflow (planned)

## 👥 User Roles & Capabilities

### 🏢 Manager Role
**Full administrative access to all restaurant operations**

#### Core Capabilities
- ✅ **Dashboard Analytics**: View key metrics, low stock alerts, financial insights
- ✅ **Inventory Management**: Full CRUD operations on all inventory items
- ✅ **Staff Management**: Employee records, hiring, scheduling oversight
- ✅ **Menu Management**: Create, edit, price menu items and categories
- ✅ **Vendor Management**: Supplier relationships and procurement
- ✅ **Event Planning**: Special events and reservation management
- ✅ **Financial Oversight**: Cost analysis, revenue tracking, profit margins

#### Manager Dashboard Tabs
1. **Overview**: Real-time metrics, alerts, today's schedule
2. **Inventory**: Stock levels, reorder alerts, cost tracking
3. **Staff**: Employee management, performance, scheduling
4. **Shifts**: Schedule optimization, shift assignments
5. **Menu**: Item management, pricing, availability
6. **Vendors**: Supplier relationships, orders, payments
7. **Events**: Special events, reservations, planning

#### Manager Workflows

##### AI Schedule Proposal (Manager Overview → AI Propose Week)
- Generate a draft schedule using either Local or AI generator.
- Local generator: no network calls; builds a client-side draft you can edit.
- AI generator: calls `/api/schedule/propose` to fetch a proposal; still client-side until approval.
- Review in List or Calendar view; edit rows inline.
- Approve and Create performs PocketBase writes. Brunch shifts must be on Sunday.

Key features
- Positions supported (aligned with Staff/Shift):
  - `manager`, `general_manager`, `owner`, `server`, `host`, `bartender`, `barback`, `busser`, `chef`, `kitchen_prep`, `kitchen`, `dishwasher`, `head_of_security`, `security`, `doorman`
- Controls by position:
  - Weekday (Mon–Thu): Lunch (enabled by default) and Dinner toggles with counts
  - Weekend (Fri–Sun): Lunch/Dinner counts
  - Bartender: Bar nights (Fri/Sat/Sun), Start/End, Bartenders count
- Global: Days to include (Sun–Sat), Include Sunday brunch
- Calendar view enhancements:
  - Per-day header chips show role icons, colored backgrounds, and counts (click to filter that day)
  - + / − buttons next to each chip to quickly add/remove a role’s shift for that day (proposal-only edit)
  - Each shift card shows a colored icon badge for the role before the staff name
- Approve UX: shows a progress bar indicating save progress as shifts are created

Default time blocks (Local generator)
- Brunch: 08:00–13:00
- Lunch: 11:00–17:00
- Dinner: 14:00–23:00

Staff assignment
- Uses PocketBase staff records matched by position/role
- Cycles through matches per role/day and falls back to mock if none found

Setup notes:
- Set `OPENAI_API_KEY` in a local `.env` for AI mode (do not commit secrets). If missing/invalid, the UI uses Local fallback.
- Environment keys sample in `.env.example`.

**Daily Operations Checklist:**
1. **Morning Review** (5-10 minutes)
   - Check overnight alerts and notifications
   - Review today's schedule and staffing
   - Check low stock alerts and critical inventory
   - Review event bookings and special requirements

2. **Inventory Management** (15-20 minutes)
   - Update stock levels from morning deliveries
   - Process vendor invoices and payments
   - Set reorder alerts for critical items
   - Review food cost percentages

3. **Staff Management** (10-15 minutes)
   - Confirm shift attendance and coverage
   - Handle shift changes and time-off requests
   - Review performance metrics and feedback
   - Update schedules for upcoming week

4. **Financial Review** (10 minutes)
   - Check daily revenue against targets
   - Review cost analysis and profit margins
   - Monitor payment processing and outstanding invoices

**Weekly Management Tasks:**
- Schedule planning and optimization
- Vendor relationship reviews and negotiations
- Menu analysis and pricing adjustments
- Staff performance reviews and training
- Financial reporting and budget planning

### 👨‍🍳 Server Role
**Limited access focused on daily operational needs**

#### Core Capabilities
- ✅ **Shift Management**: View schedules, confirm attendance, clock in/out
- ✅ **Table Management**: Order taking, payment processing, table status
- ✅ **Cross-Section Help**: Assist other sections when needed
- ✅ **Menu Reference**: Access full menu with allergens and prep times
- ✅ **Order Workflow**: Complete order lifecycle from taking to payment
- ✅ **Profile Management**: Update personal information and preferences
- ❌ **No Admin Access**: Cannot modify business data or view financial info

#### Server Dashboard Features
1. **Today's Shifts**: Current schedule, check-in status, break times
2. **Table Management**: Order interface, payment processing, status updates
3. **Menu Reference**: Complete menu with filtering, allergens, prep times
4. **My Schedule**: Upcoming shifts and availability
5. **My Profile**: Personal information and preferences

#### Server Workflows

**Shift Start Checklist:**
1. **Clock In** (2 minutes)
   - Confirm shift attendance in dashboard
   - Review today's schedule and break times
   - Check section assignments and table layout

2. **Pre-Service Setup** (10-15 minutes)
   - Review menu updates and daily specials
   - Check table status and previous shift notes
   - Set up helping sections (cross-section management)
   - Test payment processing system

3. **Service Operations**
   - **Order Taking**: Use menu filtering system for quick item lookup
   - **Table Management**: Update status throughout meal progression
   - **Payment Processing**: Handle cash and card payments securely
   - **Cross-Section Help**: Assist other servers when needed

**During Service - Table Management:**
- 🟢 **Available**: Ready for new guests
- 🟠 **Ordering**: Taking order, menu consultation
- 🔵 **Kitchen**: Order sent to kitchen, being prepared
- 🔵 **Ready**: (Pulse) Items ready for pickup
- 🟣 **Served**: Food delivered to guests
- 🟡 **Payment**: Processing payment
- ⚫ **Cleaning**: Table being reset

**End of Shift:**
1. Complete all table settlements
2. Process final payments and tips
3. Update shift status to completed
4. Hand off active tables to next shift

#### Advanced Server Features

**Menu Filtering & View Modes:**
- **Multi-select categories**: Dinner + Wine + Cocktails simultaneously
- **Default selections**: Optimized for common service (Dinner, Wine, Cocktails, Beer)
- **Grid/List toggle**: Switch between `▦ Grid` (visual) and `≡ List` (minimal compact list) near the category chips
- **Persistence**: Remembers your choice in `localStorage` across sessions
- **Quick workflows**:
  - Dinner service: Default filters already optimized ✅
  - Happy hour: Uncheck Dinner, check Happy Hour
  - Dessert service: Uncheck Dinner, check Desserts
  - Lunch service: Uncheck Dinner, check Lunch

**Cross-Section Table Management:**
- Click "Help Here" on any section to assist other servers
- Tables from helping sections appear in main "Your Tables" area
- Visual distinction: assigned section (green), helping sections (blue)
- Preferences persist across page refreshes

**Payment Workflow Options:**
- **Direct Access**: Go straight to order interface (fewer clicks)
- **Show Details First**: Review table details before proceeding (more control)
- Customizable click behavior for optimal workflow

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation & Setup

1. **Clone and Install**
```bash
git clone <repository-url>
cd parc
pnpm install
```

2. **Environment Configuration**
Create `.env` file:
```bash
# PocketBase URL (client)
VITE_POCKETBASE_URL=https://pocketbase-production-7050.up.railway.app/

# PocketBase admin (server) — used by the OpenTable webhook to update table status
# Do NOT commit real secrets. Set these only in .env / hosting env vars.
PB_ADMIN_EMAIL=your-admin@example.com
PB_ADMIN_PASSWORD=your-strong-password

# Hold window (minutes before start_time to apply base table hold for same-day)
HOLD_APPLY_MINUTES=120
```

3. **Start Development Server**
```bash
pnpm dev
```

4. **Access the Application**
- Open http://localhost:5173
- Use provided credentials for your role
- Manager access: Admin dashboard with all features
- Server access: Operational dashboard with table management

### Development Commands

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
pnpm test <pattern>       # Run specific test files

# Code Quality
pnpm lint                 # Run ESLint
pnpm format               # Format code with Prettier
```

## 🏗️ Architecture

### Tech Stack
- **Frontend**: SvelteKit + TypeScript
- **Backend**: PocketBase (BaaS)
- **Database**: SQLite (via PocketBase)
- **Styling**: Tailwind CSS
- **Authentication**: PocketBase Auth
- **Deployment**: Fly.io (PocketBase), TBD (Frontend)

### Key Features
- **Role-based Access Control**: Secure, permission-based user management
- **Real-time Operations**: Live updates for orders and table status
- **Cross-device Compatibility**: Works on desktop, tablet, and mobile
- **Offline Capability**: Continue working during network interruptions
- **Advanced Filtering**: Multi-select menu filtering for efficient service
- **Payment Integration**: Secure payment processing with Stripe

## 📱 User Experience Highlights

### For Managers
- **Comprehensive Analytics**: Real-time insights into all operations
- **Streamlined Workflows**: Efficient tools for daily management tasks
- **Cost Control**: Detailed tracking of inventory, labor, and profitability
- **Staff Oversight**: Complete visibility into schedules and performance

### For Servers
- **Intuitive Interface**: Quick access to all necessary tools
- **Efficient Order Taking**: Advanced menu filtering and search
- **Flexible Table Management**: Handle multiple sections seamlessly
- **Payment Simplicity**: Streamlined payment processing workflow

## 🔒 Security & Permissions

### Access Control
- **Authentication Required**: All features require valid login
- **Role-based Permissions**: Strict separation of manager vs server access
- **Session Management**: Secure session handling with auto-logout
- **Data Protection**: Sensitive information only visible to authorized roles

### Data Security
- **Encrypted Communication**: All API calls use HTTPS
- **Input Validation**: Client and server-side validation
- **SQL Injection Prevention**: Parameterized queries via PocketBase
- **XSS Protection**: Built-in Svelte security features

## 🛠️ Technical Details

### Database Collections
The system uses 14+ PocketBase collections including:
- User authentication and profiles
- Menu items with categories and allergens
- Order/ticket management with kitchen workflow
- Table and section management
- Staff scheduling and shifts
- Inventory and vendor management
- Payment processing and history

### API Integration
- RESTful API via PocketBase
- Real-time updates with WebSocket support
- Collection-based CRUD operations
- Automatic data synchronization

## ✅ Recent Updates

### Reservations → Table auto-assignment + hold policy (OpenTable webhook + apply-holds)
- The public reservations form (`/dashboard/reservations/form`) posts to `/api/reservations/opentable`.
- The webhook:
  - Normalizes date/time and creates a `reservations` record.
  - Auto-selects a conflict-free table based on party size and current day reservations.
  - Sets `reservation.table_id` and (if section is not provided) infers section from table.
  - Hold policy: updates the base table status to `reserved` only when the reservation is for today and within `HOLD_APPLY_MINUTES` minutes of `start_time`.
  - Optional debug mode (`?debug=1`) prints selection, attempts, `holdApply`, and `tableAfter` to the console.
- Manager → Floor Plan overlays reservations as reserved in any date/time window, independently of base table status.
- New endpoint: `/api/reservations/apply-holds` (POST)
  - Day-of idempotent job: applies holds to tables for reservations starting within `HOLD_APPLY_MINUTES`.
  - Use `?debug=1` to see per-reservation attempts.
- Configure admin env so the server can update tables:
  - `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`
  - `HOLD_APPLY_MINUTES` (default: 120)

### Floor Plan uses live reservations (overlay) and reloads tables on Refresh
- Manager → Floor Plan now:
  - Fetches same-day reservations with a correct [start, next-day) window.
  - Reloads tables on Refresh so base statuses reflect any recent webhook updates.
  - Overlays tables as `reserved` for overlapping booked/seated windows.
  - Shows "Unassigned reservations in window" when a reservation lacks `table_id`.

### Reservations Page Back Button
- Added a Back button to `/dashboard/reservations`
- Behavior: uses browser history when available; falls back to `/dashboard`
- Styling matches dark theme and includes accessible label

### Manager Shift Trades Approval
- Manager dashboard shows a pulsing badge with pending trade approvals next to the avatar
- New Approve Trades button in Shifts header opens a Trades panel
- Trades panel lists pending trades (status `accepted`) with shift/time/position and from → to staff
- Approvals:
  - Approve per-row, Approve selected, Approve all
  - Auto-approve toggle persists; when enabled, newly accepted trades are approved automatically and the panel collapses

### Server My Profile (display-only)
- Server dashboard My Profile shows Email, Role, and Phone
- Phone is derived from the Staff record, not the auth record
- The old Update Profile button was removed here to keep this display-only

### Profile Editor Improvements
- Dedicated Profile editor at `/dashboard/profile` now loads phone from the Staff collection
- Staff lookup tries `staff_collection` then `staff` by `user_id`, then falls back to email
- On save: updates `users.name` and `staff.phone` (creates staff record if missing)

Notes:
- If your deployment uses the `staff` collection name instead of `staff_collection`, the app detects and updates accordingly.

## 📖 Documentation

For detailed technical documentation, see [`AGENT.md`](./AGENT.md) which includes:
- Complete collection schemas
- Development workflows
- Code style guidelines
- Testing strategies
- Deployment procedures

### Documentation TODO
- StaffModal user picker: document selection persistence behavior and fallback. Note the injected selected user when not present in fetched pages, and the potential extra guard of rendering an explicit `<option value={selectedUserId}>` before `{#each}` to prevent snapping to default during loading.
- Roles: document extended roles used in UI filters (e.g., `security`, `head_of_security`, `doorman`) and how they map to Staff positions.
- User search UX: document debounce and pagination expectations for `/api/users/search` and how auth token forwarding works in requests.

## 🤝 Contributing

1. **Setup Development Environment**
   - Follow installation instructions above
   - Ensure PocketBase collections are properly configured

2. **Development Workflow**
   - Create feature branch from main
   - Implement changes with tests
   - Update documentation as needed
   - Test across different user roles
   - Submit pull request for review

3. **Code Standards**
   - Follow existing code style and patterns
   - Use TypeScript for type safety
   - Write tests for new functionality
   - Ensure accessibility compliance

## 📞 Support

For technical support, feature requests, or questions about role-specific workflows:
- Check the documentation in [`AGENT.md`](./AGENT.md)
- Review user role capabilities above
- Contact the development team

---

**PARC Portal** - Streamlining restaurant operations through intelligent role-based management.
