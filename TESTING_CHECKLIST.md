# PARC Restaurant System Testing Checklist

## 🧪 Pre-Testing Setup

### Database State Verification
- [ ] **Transaction data cleared** (tickets, payments, completed_orders)
- [ ] **Seed data intact** (menu, staff, tables, inventory) 
- [ ] **Mixed table statuses** (available, cleaning, reserved, maintenance)
- [ ] **Staff accounts working** (server, manager, admin access)

### System Readiness
- [ ] **All critical collections exist** (`node test-collections.js`)
- [ ] **Stripe test mode configured** (test keys in .env)
- [ ] **Application loads without errors**
- [ ] **Authentication working** (login/logout flow)

## 🎯 Core Workflow Testing

### 1. Basic Order Flow Test
**Goal**: Verify standard restaurant order → payment workflow

- [ ] **Login as server** (e.g., marie.rousseau@parcbistro.com)
- [ ] **Select available table** from grid
- [ ] **Create new ticket** with customer count
- [ ] **Add 2-3 menu items** (different categories)
- [ ] **Add modifiers** to at least one item
- [ ] **Send orders to kitchen** (📋 Send Orders button)
- [ ] **Verify kitchen sees orders** (check kitchen dashboard)
- [ ] **Mark items as ready** (simulate kitchen completion)
- [ ] **Return to server dashboard**
- [ ] **Process card payment** (use 4242424242424242)
- [ ] **Complete transaction** with tip
- [ ] **Verify payment success** and table cleared
- [ ] **Check database records** (payments, completed_orders)

**Expected Result**: ✅ Complete order → payment → completion cycle

### 2. Manager Override Test
**Goal**: Test force payment when kitchen forgets to update statuses

- [ ] **Login as manager/admin**
- [ ] **Select available table**
- [ ] **Create order** with multiple items
- [ ] **Send to kitchen** but items stay "sent_to_kitchen"
- [ ] **Verify payment buttons hidden** (items not ready)
- [ ] **See yellow warning checkbox** "⚠️ Force ready & enable payment"
- [ ] **Check override checkbox**
- [ ] **Verify items update to "ready"** (real-time)
- [ ] **Verify payment buttons appear**
- [ ] **Complete payment successfully**
- [ ] **Check kitchen dashboard** shows corrected statuses
- [ ] **Verify audit trail** in database

**Expected Result**: ✅ Manager can override kitchen delays with full accountability

### 3. Payment Recovery Test
**Goal**: Test disconnected payment state recovery

- [ ] **Create order** and send to kitchen
- [ ] **Mark items ready** 
- [ ] **Start card payment** (authorize payment)
- [ ] **Simulate disconnection** (refresh page or navigate away)
- [ ] **Return to payment** (try to complete transaction)
- [ ] **Verify recovery system** finds correct order
- [ ] **See logs**: "🔍 RECOVERY: Found X active tickets"
- [ ] **Complete payment** successfully
- [ ] **Verify no duplicate charges**

**Expected Result**: ✅ System recovers from disconnected payment states

### 4. Multi-Table Concurrent Test  
**Goal**: Test multiple orders without cross-contamination

- [ ] **Login as server**
- [ ] **Table 1**: Create order, send to kitchen
- [ ] **Table 2**: Create different order, send to kitchen  
- [ ] **Table 3**: Create third order, send to kitchen
- [ ] **Mark Table 2 items ready first**
- [ ] **Process Table 2 payment** 
- [ ] **Mark Table 1 items ready**
- [ ] **Process Table 1 payment**
- [ ] **Verify no cross-contamination** (correct items on correct tables)
- [ ] **Check payment records** match correct tickets
- [ ] **Complete Table 3** last

**Expected Result**: ✅ Perfect isolation between concurrent orders

## 🏢 Realistic Restaurant Scenarios

### 5. Busy Night Simulation
**Goal**: Test system under realistic capacity constraints

- [ ] **Check table grid** shows mixed statuses
- [ ] **Count available tables** (should be limited)
- [ ] **Create orders** on most available tables
- [ ] **Experience table selection pressure**
- [ ] **Handle "no tables available" scenario**
- [ ] **Process payments** to free up tables
- [ ] **Verify table turnover** (cleaning → available)

**Expected Result**: ✅ System handles capacity constraints gracefully

### 6. Maintenance & Edge Cases
**Goal**: Test system behavior with operational constraints

- [ ] **Attempt order** on reserved table (should block)
- [ ] **Try to process payment** with no items (should block)
- [ ] **Test with out-of-service tables** (should be unavailable)
- [ ] **Handle cleaning tables** (should show appropriate status)
- [ ] **Verify staff role permissions** (server vs manager access)

**Expected Result**: ✅ Proper constraints and permission enforcement

## 💳 Payment System Testing

### 7. Stripe Integration Tests
**Goal**: Verify complete Stripe payment processing

#### Success Scenarios
- [ ] **Card: 4242424242424242** (Visa success)
- [ ] **Card: 5555555555554444** (Mastercard success)  
- [ ] **Card: 3782822463100005** (Amex success)
- [ ] **Various tip amounts** (percentage and custom)
- [ ] **Check Stripe dashboard** for test transactions

#### Failure Scenarios
- [ ] **Card: 4000000000000002** (Declined)
- [ ] **Card: 4000000000009995** (Insufficient funds)
- [ ] **Card: 4000000000000069** (Expired card)
- [ ] **Verify error handling** and user feedback
- [ ] **Confirm no database corruption** on failures

**Expected Result**: ✅ Robust payment processing with proper error handling

### 8. Payment Data Integrity
**Goal**: Verify complete payment audit trail

- [ ] **Process payment** with tip
- [ ] **Check payments_collection** record created
- [ ] **Verify stripe_id** field populated
- [ ] **Check completed_orders** record created  
- [ ] **Confirm amount breakdown** (subtotal, tip, total)
- [ ] **Verify processor details** (server, timestamp)
- [ ] **Cross-reference** Stripe dashboard transaction

**Expected Result**: ✅ Perfect data integrity and audit trail

## 🔍 Advanced Feature Testing

### 9. Kitchen Coordination  
**Goal**: Test kitchen staff workflow integration

- [ ] **Login as kitchen staff** (if available)
- [ ] **View incoming orders** from server tickets
- [ ] **Update item statuses** (preparing → ready)
- [ ] **Verify real-time updates** on server dashboard
- [ ] **Test status progression** throughout cooking process

**Expected Result**: ✅ Seamless kitchen-server coordination

### 10. Inventory Impact Tracking
**Goal**: Verify inventory consumption recording

- [ ] **Note starting state** of inventory items
- [ ] **Process multiple orders** with tracked items
- [ ] **Check completed_orders** for item details
- [ ] **Verify JSON data** includes all modifications
- [ ] **Calculate theoretical consumption**
- [ ] **Compare with actual order records**

**Expected Result**: ✅ Foundation for inventory management reporting

## 🚨 Error Handling & Recovery

### 11. System Resilience Tests
**Goal**: Test graceful error handling

- [ ] **Network interruption** during payment
- [ ] **Database connection issues** 
- [ ] **Invalid payment intents**
- [ ] **Malformed order data**
- [ ] **Session timeout** scenarios
- [ ] **Verify user feedback** for all error cases

**Expected Result**: ✅ Graceful degradation with clear user guidance

### 12. Data Consistency Validation
**Goal**: Ensure data integrity under stress

- [ ] **Rapid order creation**
- [ ] **Quick payment processing** 
- [ ] **Simultaneous user actions**
- [ ] **Check for duplicate records**
- [ ] **Verify relationship consistency**
- [ ] **Confirm no orphaned data**

**Expected Result**: ✅ Perfect data consistency under load

## 📊 Performance & Monitoring

### 13. Performance Baseline
**Goal**: Establish system performance metrics

- [ ] **Measure order creation time**
- [ ] **Track payment processing speed**
- [ ] **Monitor database response times**
- [ ] **Check UI responsiveness**
- [ ] **Document baseline metrics**

**Expected Result**: ✅ Performance baseline for future optimization

### 14. Monitoring & Logging
**Goal**: Verify comprehensive system monitoring

- [ ] **Check console logs** for descriptive messages
- [ ] **Verify payment flow logging**
- [ ] **Review error reporting** 
- [ ] **Confirm audit trail completeness**
- [ ] **Test log readability** for debugging

**Expected Result**: ✅ Comprehensive monitoring for operations

## ✅ Testing Completion

### Final Validation
- [ ] **All core workflows** function perfectly
- [ ] **Error handling** robust and user-friendly  
- [ ] **Data integrity** maintained throughout
- [ ] **Payment processing** secure and reliable
- [ ] **User experience** intuitive and efficient
- [ ] **System monitoring** comprehensive and clear

### Documentation Updates
- [ ] **Test results** documented with screenshots
- [ ] **Known issues** identified and prioritized
- [ ] **Performance metrics** recorded
- [ ] **Recommendations** for production deployment

### Production Readiness
- [ ] **Security review** completed
- [ ] **Backup procedures** tested
- [ ] **Monitoring alerts** configured
- [ ] **Staff training** materials prepared
- [ ] **Go-live checklist** created

---

## 🎯 Testing Notes Template

**Test Date**: ___________  
**Tester**: ___________  
**Environment**: Development/Staging  
**Stripe Mode**: Test  

### Issues Found
| Priority | Issue | Steps to Reproduce | Expected | Actual | Status |
|----------|-------|-------------------|----------|---------|---------|
| High | | | | | |
| Medium | | | | | |
| Low | | | | | |

### Performance Metrics
| Operation | Average Time | Notes |
|-----------|-------------|-------|
| Order Creation | | |
| Payment Processing | | |
| Database Queries | | |

### Recommendations
- [ ] **Immediate fixes** required before production
- [ ] **Performance optimizations** identified  
- [ ] **Feature enhancements** suggested
- [ ] **User training** recommendations

**Overall System Status**: ⭐⭐⭐⭐⭐ (Ready for Production)
