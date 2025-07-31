# Role-Based Workflow System for PARC Restaurant

## Role Capabilities Overview

### 🧑‍🍳 **Chef Capabilities**
- **Product Requests**: Request inventory items when running low
- **Menu Updates**: Modify menu items and availability
- **Kitchen Operations**: Manage prep schedules and recipes
- **Inventory Alerts**: Receive low-stock notifications

### 👥 **Server Capabilities**  
- **Employee Requests**: Create common staff requests (time off, schedule changes, shift swaps)
- **Event Management**: Book and manage customer events
- **Customer Service**: Handle reservations and special requests
- **Schedule Coordination**: View and coordinate shift coverage

### 👔 **Manager Capabilities**
- **Real-time Dashboard**: Monitor all operations live
- **Request Management**: Approve/deny all employee requests
- **Staff Coordination**: Manage shifts, assignments, and coverage
- **Operational Control**: Full CRUD access to daily operations
- **Performance Monitoring**: Track staff and operational metrics

### 🏢 **Owner Capabilities**
- **Executive Dashboard**: High-level business overview
- **Financial Analytics**: Revenue, costs, profit charts and trends
- **Strategic Decisions**: Make major operational changes
- **Staff Management**: Hire, terminate, and promote decisions
- **Business Intelligence**: Long-term planning and forecasting

## New Collections Needed

### 1. Product Requests Collection
```json
{
  "name": "product_requests",
  "fields": [
    {"name": "requested_by", "type": "relation", "collection": "staff"},
    {"name": "inventory_item", "type": "relation", "collection": "inventory_items"},
    {"name": "quantity_requested", "type": "number"},
    {"name": "urgency", "type": "select", "values": ["low", "medium", "high", "critical"]},
    {"name": "reason", "type": "text"},
    {"name": "status", "type": "select", "values": ["pending", "approved", "ordered", "received", "denied"]},
    {"name": "approved_by", "type": "relation", "collection": "staff"},
    {"name": "request_date", "type": "date"},
    {"name": "needed_by", "type": "date"},
    {"name": "estimated_cost", "type": "number"},
    {"name": "notes", "type": "text"}
  ]
}
```

### 2. Employee Requests Collection
```json
{
  "name": "employee_requests",
  "fields": [
    {"name": "requested_by", "type": "relation", "collection": "staff"},
    {"name": "request_type", "type": "select", "values": ["time_off", "schedule_change", "shift_swap", "training", "equipment", "other"]},
    {"name": "title", "type": "text"},
    {"name": "description", "type": "text"},
    {"name": "start_date", "type": "date"},
    {"name": "end_date", "type": "date"},
    {"name": "status", "type": "select", "values": ["pending", "approved", "denied", "in_review"]},
    {"name": "priority", "type": "select", "values": ["low", "medium", "high"]},
    {"name": "reviewed_by", "type": "relation", "collection": "staff"},
    {"name": "review_notes", "type": "text"},
    {"name": "created_date", "type": "datetime"},
    {"name": "review_date", "type": "datetime"}
  ]
}
```

### 3. Financial Metrics Collection
```json
{
  "name": "financial_metrics",
  "fields": [
    {"name": "date", "type": "date"},
    {"name": "daily_revenue", "type": "number"},
    {"name": "daily_costs", "type": "number"},
    {"name": "labor_costs", "type": "number"},
    {"name": "food_costs", "type": "number"},
    {"name": "overhead_costs", "type": "number"},
    {"name": "customer_count", "type": "number"},
    {"name": "average_ticket", "type": "number"},
    {"name": "profit_margin", "type": "number"},
    {"name": "notes", "type": "text"}
  ]
}
```

## Updated Security Rules

### Product Requests Collection
```javascript
// List Rule - Kitchen staff and managers can see requests
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "chef" || @request.auth.role = "kitchen_prep" || requested_by.user_id = @request.auth.id

// View Rule - Same as list
@request.auth.role = "owner" || @request.auth.role = "manager" || @request.auth.role = "chef" || @request.auth.role = "kitchen_prep" || requested_by.user_id = @request.auth.id

// Create Rule - Only kitchen staff can create requests
@request.auth.role = "chef" || @request.auth.role = "kitchen_prep"

// Update Rule - Requesters can update pending requests, managers can update status
(@request.auth.role = "owner" || @request.auth.role = "manager") || (requested_by.user_id = @request.auth.id && status = "pending")

// Delete Rule - Only managers and owners
@request.auth.role = "owner" || @request.auth.role = "manager"
```

### Employee Requests Collection
```javascript
// List Rule - Own requests + managers see all
@request.auth.role = "owner" || @request.auth.role = "manager" || requested_by.user_id = @request.auth.id

// View Rule - Same as list
@request.auth.role = "owner" || @request.auth.role = "manager" || requested_by.user_id = @request.auth.id

// Create Rule - All authenticated staff can create requests
@request.auth.id != ""

// Update Rule - Requesters can update pending, managers can update status
(@request.auth.role = "owner" || @request.auth.role = "manager") || (requested_by.user_id = @request.auth.id && status = "pending")

// Delete Rule - Only managers and owners
@request.auth.role = "owner" || @request.auth.role = "manager"
```

### Financial Metrics Collection
```javascript
// List Rule - Only owners and managers
@request.auth.role = "owner" || @request.auth.role = "manager"

// View Rule - Same as list
@request.auth.role = "owner" || @request.auth.role = "manager"

// Create Rule - Only managers and owners
@request.auth.role = "owner" || @request.auth.role = "manager"

// Update Rule - Same as create
@request.auth.role = "owner" || @request.auth.role = "manager"

// Delete Rule - Only owners
@request.auth.role = "owner"
```

## Dashboard Specifications

### Chef Dashboard Features
- **Inventory Status**: Current stock levels with low-stock alerts
- **Product Request Form**: Quick request submission
- **Menu Management**: Update item availability and prices
- **Kitchen Schedule**: View prep tasks and timelines
- **Request History**: Track submitted and approved requests

### Server Dashboard Features
- **Employee Request Portal**: Common request forms (time off, schedule changes)
- **Event Management**: Book and manage customer events
- **Shift Coordination**: View schedules and request coverage
- **Customer Requests**: Handle special dining requests
- **Team Communication**: Message board and updates

### Manager Dashboard Features
- **Real-time Operations Monitor**: Live view of all activities
- **Request Management Center**: Approve/deny all pending requests
- **Staff Performance Metrics**: Track productivity and attendance
- **Inventory & Financial Overview**: Key operational metrics
- **Schedule Management**: Assign shifts and manage coverage
- **Alert System**: Critical issues requiring immediate attention

### Owner Dashboard Features
- **Executive Summary**: High-level business performance
- **Financial Analytics**: 
  - Revenue trends and forecasting
  - Cost analysis and profit margins
  - Labor cost percentages
  - ROI on investments
- **Strategic Planning Tools**: Long-term business metrics
- **Staff Performance Overview**: Hiring and promotion insights
- **Market Analysis**: Competitor and industry trends
- **Decision Support**: Data-driven action recommendations

## Real-time Features

### Live Data Streams
- **Inventory levels** updating as items are used
- **Request status changes** as they're approved/denied
- **Financial metrics** updating throughout the day
- **Staff clock-in/out** status changes
- **Event bookings** and cancellations

### Notification System
- **Chefs**: Low stock alerts, request approvals
- **Servers**: Schedule changes, request responses
- **Managers**: Critical alerts, new requests, staff issues
- **Owners**: Financial thresholds, major operational changes

## Implementation Priority

### Phase 1 (High Priority)
1. Create Product Requests and Employee Requests collections
2. Implement basic dashboard views for each role
3. Set up security rules for proper access control

### Phase 2 (Medium Priority)
1. Add Financial Metrics collection and reporting
2. Implement real-time updates using PocketBase subscriptions
3. Create notification system

### Phase 3 (Future Enhancement)
1. Advanced analytics and forecasting
2. Mobile app integration
3. Integration with POS systems
4. Automated inventory reordering
