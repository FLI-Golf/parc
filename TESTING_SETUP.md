# PARC Testing System Setup

## Overview
Comprehensive testing setup for the PARC restaurant management system, including database collection validation, Stripe test payments, and automated test data generation.

## Database Collections Status

### ✅ Required Collections (Complete)
Run this script to verify all collections exist:

```bash
node check-missing-collections-complete.js
```

### 📋 Missing Collections Update
Updated `check-missing-collections.js` to include ALL application collections:

**Payment & Order Collections:**
- `tickets_collection` - Order/ticket management
- `ticket_items_collection` - Individual items within orders
- `payments_collection` - Payment processing records  
- `completed_orders` - Historical completed order data

**Menu & Catalog Collections:**
- `menu_categories` - Menu item categories
- `menu_modifiers` - Modifiers for menu items

**Core Application Collections:**
- `users` - User authentication (built-in PocketBase)
- `sections_collection` - Restaurant sections/areas

## Stripe Testing Configuration

### Test Mode Setup
The application is already configured for Stripe testing:

**Environment Variables (`.env`):**
```bash
# Stripe Test Keys (Safe for development)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Public test key
STRIPE_SECRET_KEY=sk_test_...            # Secret test key (server only)
```

### Test Payment Cards
Use these cards for testing payments **without real charges**:

**Success Cards:**
```
4242424242424242  # Visa - Always succeeds
5555555555554444  # Mastercard - Always succeeds  
3782822463100005  # Amex - Always succeeds
```

**Error Testing Cards:**
```
4000000000000002  # Card declined
4000000000009995  # Insufficient funds  
4000000000000069  # Expired card
4000000000000127  # Incorrect CVC
```

**Testing Details:**
- Any future expiration date (e.g., `12/34`)
- Any 3-digit CVC (e.g., `123`)
- Any billing details

### Payment Testing Workflow

1. **Create Order**: Add items to cart
2. **Send to Kitchen**: Mark items as sent
3. **Test Scenarios**:
   - **Normal Flow**: Wait for items to be "ready", then pay
   - **Manager Override**: Use force payment checkbox to bypass status
   - **Payment Recovery**: Test disconnected payment states
   - **Multiple Payments**: Test concurrent orders

4. **Verify Results**:
   - Check `payments` collection for records
   - Check `completed_orders` for order history  
   - Verify Stripe dashboard shows test transactions
   - Confirm inventory tracking data

## Test Data Generation

### Automated Test Data Script
Create realistic test data for comprehensive testing:

```javascript
// test-data-generator.js
async function generateTestData() {
  // Create test tables
  // Create test menu items
  // Create test staff members
  // Generate sample orders
  // Create payment scenarios
}
```

### Manual Test Scenarios

#### 1. Basic Order Flow Test
```
1. Login as server
2. Select table T1
3. Add 2 menu items
4. Send to kitchen
5. Mark items ready (kitchen)
6. Process payment
7. Verify completion
```

#### 2. Manager Override Test  
```
1. Create order with items "sent_to_kitchen"
2. Login as manager
3. Use "Force ready & enable payment" checkbox
4. Verify items update to "ready"
5. Complete payment
6. Check audit trail
```

#### 3. Payment Recovery Test
```
1. Start payment authorization
2. Refresh page/lose context
3. Attempt payment completion  
4. Verify recovery finds correct order
5. Complete payment successfully
```

#### 4. Multi-Table Concurrent Test
```
1. Create orders on multiple tables
2. Send all to kitchen at different times
3. Process payments in different order
4. Verify no cross-contamination
```

## Database Validation

### Pre-Test Checklist
Run before each testing session:

```bash
# 1. Verify all collections exist
node check-missing-collections-complete.js

# 2. Check authentication works
node test-auth.js

# 3. Verify Stripe connectivity  
node test-stripe-connection.js

# 4. Validate menu data
node validate-menu-data.js
```

### Test Data Cleanup
After testing, clean up test data:

```bash
# Remove test orders (keep real data)
node cleanup-test-data.js

# Reset test tables to available
node reset-table-status.js
```

## Performance Testing

### Load Testing Scenarios
1. **Concurrent Orders**: Multiple servers processing orders simultaneously
2. **High Volume**: Many items per order, complex modifiers
3. **Payment Stress**: Rapid payment processing cycles
4. **Database Load**: Large menu catalogs, extensive order history

### Monitoring Points
- **Database Response Times**: PocketBase query performance
- **Stripe API Latency**: Payment processing speed
- **UI Responsiveness**: Client-side performance
- **Memory Usage**: Long-running sessions

## Security Testing

### Authentication Tests
- Role-based access control validation
- Token expiration handling
- Unauthorized access prevention

### Payment Security Tests  
- Stripe webhook validation
- Payment intent security
- PCI compliance verification

### Data Protection Tests
- Sensitive data encryption
- Audit trail integrity
- Role-based data access

## Continuous Testing

### Automated Test Suite
```bash
# Run full test suite
npm run test:full

# Payment-specific tests
npm run test:payments

# Database integration tests  
npm run test:database

# Stripe integration tests
npm run test:stripe
```

### Test Environment Management
- **Development**: Local testing with test Stripe keys
- **Staging**: Full integration testing environment  
- **Production**: Live monitoring and health checks

## Troubleshooting Guide

### Common Issues

**Payment Failures:**
1. Check Stripe key configuration
2. Verify test card numbers
3. Check payment intent status
4. Review console logs for errors

**Collection Errors:**
1. Run collection existence check
2. Verify PocketBase authentication
3. Check collection permissions
4. Review field schema matches

**Order State Issues:**
1. Check ticket/item status flow
2. Verify collection relationships
3. Test recovery mechanisms
4. Review audit trails

### Debug Tools
- Browser DevTools console logs
- PocketBase admin panel logs  
- Stripe dashboard transaction logs
- Application performance monitoring

## Test Documentation

### Test Case Templates
Document all test scenarios with:
- **Preconditions**: Required setup
- **Steps**: Detailed action sequence  
- **Expected Results**: What should happen
- **Actual Results**: What actually happened
- **Screenshots**: UI state evidence

### Bug Reporting
Include for any issues found:
- Reproduction steps
- Browser/environment details
- Console error messages
- Database state snapshots
- Stripe transaction IDs

## Success Metrics

### Payment System Health
- ✅ 100% payment authorization success rate
- ✅ < 2 second average payment processing time
- ✅ Zero payment data loss incidents
- ✅ 100% Stripe webhook processing

### Data Integrity
- ✅ Perfect order → payment → completion tracking
- ✅ Accurate inventory consumption records
- ✅ Complete audit trails for all transactions
- ✅ Zero data corruption incidents

### User Experience
- ✅ Intuitive workflow progression
- ✅ Clear error messages and recovery
- ✅ Responsive UI under load
- ✅ Role-appropriate access controls
