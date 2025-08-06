# Payment Workflow & Management Features

## Overview
The PARC restaurant management system includes sophisticated payment controls, role-based overrides, and inventory tracking capabilities designed for real-world restaurant operations.

## Payment Control Workflow

### Normal Payment Flow
1. **Order Creation**: Server adds items to ticket
2. **Send to Kitchen**: Items marked as "sent_to_kitchen" 
3. **Kitchen Updates**: Staff marks items as "preparing" → "ready"
4. **Payment Available**: When all items are "ready" or "preparing"
5. **Payment Processing**: Stripe integration with tip handling
6. **Order Completion**: Items marked "completed", table available

### Smart Payment Controls

#### Automatic Payment Blocking
- **Payment buttons are hidden** until all items are ready
- Prevents premature payment when orders aren't complete
- Maintains service quality and customer satisfaction

#### Manager Override System
**Role-Based Access**: Only Managers, Admins, and Owners can override

**When to Use**:
- Kitchen staff forgets to update item status in system
- Items are physically ready but marked as "sent_to_kitchen"
- Service recovery situations requiring immediate payment

**How It Works**:
1. Yellow warning checkbox appears: "⚠️ Force ready & enable payment"
2. Manager checks the box
3. **System automatically updates all items to 'ready' status**
4. Payment buttons become available
5. Creates audit trail of manual overrides

```javascript
// Auto-update item statuses when manager forces payment
for (const item of currentTicketItems) {
    if (item.status !== 'ready') {
        await collections.updateTicketItem(item.id, { status: 'ready' });
    }
}
// Refresh local display to show updated statuses
currentTicketItems = await collections.getTicketItems(currentTicket.id);
```

#### Real-Time System Updates

**Client-Side Updates (Immediate)**:
- ✅ **Server Dashboard**: Items change from "sent_to_kitchen" → "ready"
- ✅ **Order Status Modal**: Shows "READY - Ready now!" instead of "SENT_TO_KITCHEN"  
- ✅ **Payment Buttons**: Become immediately available
- ✅ **Visual Feedback**: Status indicators update across all UI components

**Database Updates (Permanent)**:
- ✅ **All item statuses** updated to 'ready' in ticket_items collection
- ✅ **Kitchen Dashboard** shows items as ready on next refresh
- ✅ **Order tracking** reflects accurate status across all screens
- ✅ **Audit trail** maintained for manager override actions

**System-Wide Consistency**:
When a manager uses the override, the correction propagates throughout the entire system:

1. **Server sees**: Items instantly change to "ready" status
2. **Kitchen staff see**: Corrected status on their dashboard (prevents confusion)
3. **Managers see**: Override action logged for accountability
4. **System maintains**: Complete audit trail of who made corrections when

#### Example Scenario: Kitchen Coordination Issue

**Problem**: Kitchen finishes Boeuf Bourguignon but forgets to update system
- Order shows: "SENT_TO_KITCHEN" 
- Reality: Food is ready and getting cold
- Customer: Waiting to pay and leave

**Manager Solution**:
1. Manager sees order stuck at "sent_to_kitchen" status
2. Verifies with kitchen that food is actually ready
3. Checks "⚠️ Force ready & enable payment" checkbox
4. **Instant Results**:
   - Payment buttons appear immediately
   - Kitchen dashboard shows corrected status
   - Service continues without delay
   - Full accountability maintained

**Audit Trail Created**:
- Timestamp of manager override
- Which items were force-updated
- Manager who performed the action
- Customer service maintained without system blocking

## Role-Based Permissions

### Server Permissions
- ✅ Create orders and add items
- ✅ Send orders to kitchen
- ✅ Process payments (when items ready)
- ❌ Cannot force payment overrides
- ❌ Cannot modify item statuses manually

### Manager/Admin/Owner Permissions
- ✅ All server permissions
- ✅ Force payment when items aren't ready
- ✅ Override kitchen status updates
- ✅ Access to inventory and waste reports
- ✅ Manual item status corrections

## Inventory Tracking & Reporting

### Data Collection
Every completed order creates comprehensive records:

**Completed Orders Collection**:
- Ticket ID and table information
- Complete item list with quantities
- Timestamps and server information
- Total amounts and payment details

**Payments Collection**:
- Stripe payment intent linking
- Amount breakdown (subtotal, tip, total)
- Payment method and processor details
- Server who processed payment

### Available Reports

#### Daily Inventory Usage
```sql
-- Theoretical inventory consumed (perfect efficiency)
SELECT 
    menu_item_name,
    SUM(quantity) as items_sold,
    SUM(quantity * ingredient_cost) as theoretical_cost
FROM completed_orders 
WHERE date = today
GROUP BY menu_item_name
```

#### Waste & Efficiency Analysis
- **Theoretical vs. Actual**: Compare perfect efficiency to real usage
- **Modifier Impact**: Track custom orders and special requests
- **Variance Reports**: Identify areas of waste or theft
- **Portion Control**: Monitor consistency across servers

#### Revenue Analysis
- **Sales by item category** (appetizers, mains, beverages)
- **Server performance** (average ticket size, tips)
- **Peak hours analysis** for staffing optimization
- **Payment method preferences** (card vs. cash trends)

### Example Scenario: Inventory Reconciliation

**Perfect Night (No Waste)**:
- 10 Boeuf Bourguignon sold = 10 portions beef, 10 portions vegetables
- System shows exactly what should be consumed

**Real Night Analysis**:
- Physical count shows 12 portions beef used
- **2 portion variance** - investigation needed:
  - Kitchen error/waste?
  - Unreported modifier?
  - Portion size inconsistency?
  - Potential theft?

**Manager Investigation Tools**:
- Order modification logs
- Server override usage
- Time-stamped kitchen updates
- Payment completion records

## Technical Implementation

### Payment Recovery System
Handles disconnected payment states where Stripe has authorization but order context is lost:

```javascript
// Automatic order recovery
const matchingTickets = $tickets.filter(ticket => {
    return ticket.status === 'sent_to_kitchen' || ticket.status === 'payment_processing';
});

if (matchingTickets.length === 1) {
    // Auto-restore order context
    selectedTable = table;
    currentTicket = ticket;
    currentTicketItems = await collections.getTicketItems(ticket.id);
}
```

### Database Schema Integration

**Payments Table** (with Stripe integration):
```json
{
  "ticket_id": "relation_to_tickets",
  "amount": "number (subtotal)",
  "tip_amount": "number",
  "stripe_id": "text (payment_intent_id)",
  "transaction_id": "text",
  "processed_by": "relation_to_staff",
  "status": "completed|pending|failed",
  "processed_at": "datetime"
}
```

## Benefits

### Operational Excellence
- **Service Quality**: No premature payments
- **Staff Accountability**: Clear role-based permissions
- **Error Recovery**: Manager tools for real-world issues
- **Audit Trail**: Complete transaction history

### Financial Controls
- **Accurate Inventory**: Perfect tracking with variance analysis
- **Theft Prevention**: Systematic monitoring of discrepancies  
- **Cost Management**: Real-time food cost analysis
- **Revenue Optimization**: Data-driven menu and pricing decisions

### Scalability
- **Multi-location Ready**: Role-based permissions scale across restaurants
- **Integration Friendly**: Clean APIs for POS systems and accounting
- **Reporting Foundation**: Data structure supports advanced analytics
- **Compliance Ready**: Audit trails for health inspections and tax reporting

## Future Enhancements

### Planned Features
- **Real-time Inventory Alerts** when variance exceeds thresholds
- **Predictive Analytics** for food ordering and waste reduction
- **Mobile Kitchen App** for faster status updates
- **Customer Feedback Integration** linking satisfaction to order timing
- **Advanced Reporting Dashboard** with visual analytics

### Integration Opportunities
- **Accounting Systems** (QuickBooks, Xero)
- **Inventory Management** (automated ordering)
- **Staff Scheduling** (based on sales patterns)
- **Customer Loyalty** (order history and preferences)
