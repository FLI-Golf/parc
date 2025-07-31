# PocketBase Security Rules for PARC Restaurant System

## Overview
Our security model follows restaurant hierarchy with flexible position assignment:
- **Admin Level** (`owner`, `manager`): Full system access
- **Lead Staff** (`server`): Can reassign positions and manage shifts
- **Staff Level** (`host`, `bartender`, `busser`): Limited access + can work different positions
- **Kitchen Level** (`chef`, `kitchen_prep`, `dishwasher`): Kitchen-specific access + cross-training

## Flexible Position System
- **Base Position**: Set in Staff collection (employee's primary role)
- **Shift Position**: Set per shift (what they're working as tonight)
- **Cross-Training**: Staff can work different positions as needed
- **Position Management**: Owners, managers, and servers can reassign positions

## Updated Collection Rules

### 1. Users Collection (`_pb_users_auth_`)
```javascript
// List Rule - Users can see others based on role hierarchy
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.id = id

// View Rule - Same as list
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.id = id

// Create Rule - Only admin can create users
@request.auth.role = "owner" || @request.auth.role = "manager"

// Update Rule - Users can update themselves, admins can update anyone
@request.auth.id = id || @request.auth.role = "owner" || @request.auth.role = "manager"

// Delete Rule - Only owner can delete users
@request.auth.role = "owner"
```

### 2. Staff Collection
```javascript
// List Rule - All authenticated users can view staff
@request.auth.id != ""

// View Rule - Same as list
@request.auth.id != ""

// Create Rule - Only admin level
@request.auth.role = "owner" || @request.auth.role = "manager"

// Update Rule - Flexible position management
// - Staff can update their own basic info (but not position)
// - Owners, managers, and servers can update positions and assignments
// - Only admins can update sensitive data (hourly_rate, status)
(@request.auth.role = "owner" || @request.auth.role = "manager") || 
(@request.auth.role = "server" && (@request.data.position != "" || @request.data.hire_date = "" || @request.data.hourly_rate = "")) ||
(user_id = @request.auth.id && @request.data.position = "" && @request.data.hourly_rate = "" && @request.data.status = "")

// Delete Rule - Only owner
@request.auth.role = "owner"
```

### 3. Shifts Collection
```javascript
// List Rule - Users can see their own shifts + admins and servers see all
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "server" || staff_member.user_id = @request.auth.id

// View Rule - Same as list
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "server" || staff_member.user_id = @request.auth.id

// Create Rule - Admin level and servers (for coverage/staffing)
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "server"

// Update Rule - Flexible shift and position management
// - Staff can update their own shift status and accept position changes
// - Owners, managers, and servers can update any shift including position assignments
// - Position changes reflect cross-training capabilities
(@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "server") || 
(staff_member.user_id = @request.auth.id && (@request.data.status != "" || @request.data.position != ""))

// Delete Rule - Admin level and servers
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "server"
```

### 4. Inventory Items Collection
```javascript
// List Rule - All authenticated users can view inventory
@request.auth.id != ""

// View Rule - Same as list
@request.auth.id != ""

// Create Rule - Admin and kitchen staff
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "chef" || @request.auth.role = "kitchen_prep"

// Update Rule - Admin and kitchen staff
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "chef" || @request.auth.role = "kitchen_prep"

// Delete Rule - Only admin level
@request.auth.role = "owner" || @request.auth.role = "manager"
```

### 5. Menu Items Collection
```javascript
// List Rule - All authenticated users can view menu
@request.auth.id != ""

// View Rule - Same as list
@request.auth.id != ""

// Create Rule - Admin and kitchen staff
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "chef"

// Update Rule - Admin and kitchen staff
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "chef"

// Delete Rule - Only admin level
@request.auth.role = "owner" || @request.auth.role = "manager"
```

### 6. Vendors Collection
```javascript
// List Rule - All authenticated users can view vendors
@request.auth.id != ""

// View Rule - Same as list
@request.auth.id != ""

// Create Rule - Only admin level
@request.auth.role = "owner" || @request.auth.role = "manager"

// Update Rule - Only admin level
@request.auth.role = "owner" || @request.auth.role = "manager"

// Delete Rule - Only owner
@request.auth.role = "owner"
```

### 7. Events Collection
```javascript
// List Rule - All authenticated users can view events
@request.auth.id != ""

// View Rule - Same as list
@request.auth.id != ""

// Create Rule - Admin and service staff
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "server" || @request.auth.role = "host"

// Update Rule - Admin and service staff
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "server" || @request.auth.role = "host"

// Delete Rule - Only admin level
@request.auth.role = "owner" || @request.auth.role = "manager"
```

## Position Management Examples

### Cross-Training Scenarios
1. **Bartender → Server**: Jacques (bartender) can work as server when needed
2. **Server → Host**: Marie (server) can cover host position during busy nights  
3. **Chef → Kitchen Prep**: Antoine (chef) can work prep shifts during staff shortages
4. **Multi-Position**: Staff can work different positions on same day

### Permission Examples
- **Owner Pierre**: Can assign anyone to any position, manage all data
- **Manager**: Can reassign positions, create shifts, manage operations
- **Server Marie**: Can reassign positions for coverage, view all shifts, cannot change pay rates
- **Bartender Jacques**: Can update own shifts, accept position changes, cannot reassign others
- **Kitchen Staff**: Can update inventory, accept cross-training assignments

### UI Workflow
1. **Base Position**: Set during staff onboarding (Staff collection)
2. **Shift Assignment**: Choose position per shift (can differ from base)
3. **Position Override**: Visual indicator when working outside base position
4. **Permission Check**: System validates who can make position changes

## Additional Security Measures

### Password Requirements
- Minimum 8 characters
- Must contain letters and numbers
- Account lockout after 5 failed attempts

### API Rate Limiting
- 100 requests per minute per user
- 1000 requests per hour per IP

### Data Validation
- Email format validation
- Phone number format validation
- Time format validation (HH:MM)
- Currency amount validation (min: 0)
- Position change validation (only valid roles)

### Audit Trail
- Log all create/update/delete operations
- Track user login/logout events
- Monitor failed authentication attempts
- Log position changes and reassignments

### File Upload Security
- Image files only for menu items
- Max size: 5MB
- Allowed types: JPEG, PNG, GIF, WebP
- Automatic virus scanning

## Implementation Steps

1. **Update PocketBase Admin Panel**:
   - Go to each collection
   - Update the rules with new role names
   - Test with different user roles

2. **Test Security**:
   - Create test users with different roles
   - Verify access permissions
   - Test unauthorized access attempts

3. **Monitor & Audit**:
   - Set up logging
   - Regular security reviews
   - Update rules as needed

## Emergency Procedures

### Data Breach Response
1. Immediately disable affected accounts
2. Change all admin passwords
3. Review access logs
4. Notify relevant parties
5. Update security measures

### Account Compromise
1. Force password reset
2. Invalidate all sessions
3. Review recent activities
4. Update security questions
