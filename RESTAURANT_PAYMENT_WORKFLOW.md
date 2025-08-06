# Restaurant Payment Workflow Guide

## **👥 Who Can Process Payments**

✅ **Managers** - Full access to all payment functions
✅ **Servers** - Can close their own tables and any table
✅ **Bartenders** - Can process payments after drink service
✅ **Owners** - Complete access to all payment operations

## **🎯 Real Restaurant Workflow**

### **Standard Payment Process**

1. **Guest requests check** → Server/staff prepares bill
2. **Present bill to guest** → Customer reviews subtotal
3. **Guest signs receipt** → Writes tip amount and total
4. **Staff enters tip** → Processes final payment

## **💳 Payment Flow in PARC Portal**

### **Step 1: Initiate Payment**
- **Click table** with active order
- **Click "Process Payment"** button
- **Payment modal opens** showing subtotal

### **Step 2: Enter Guest Tip (Recommended)**
- **Click "Guest Signed Tip"** (blue highlighted option)
- **Enter tip amount** that guest wrote on receipt
- **System calculates** final total automatically

### **Step 3: Process Payment**

**For Card Payments:**
- **Select "Credit/Debit Card"**
- **Swipe/insert** customer's card
- **Enter test card**: `4242424242424242` (for testing)
- **Payment processes** through Stripe

**For Cash Payments:**
- **Select "Cash"**
- **Confirm cash received** from customer
- **Payment recorded** in system

### **Step 4: Completion**
- ✅ **Receipt generated** with tip breakdown
- ✅ **Table automatically freed** for next guests
- ✅ **Kitchen notified** order complete
- ✅ **Tip recorded** for payroll/reporting

## **💡 Alternative Tip Options**

If guest doesn't sign a tip or special situations:

### **Quick Percentage Tips**
- **15%, 18%, 20%, 25%** buttons for standard amounts
- **Useful for** takeout, delivery, or when guest asks for suggestion

### **Custom Amount**
- **Manual entry** for any specific dollar amount
- **Good for** unusual circumstances or exact amounts

### **No Tip**
- **Zero tip option** for takeout, comps, or when declined

## **🔍 Real-World Examples**

### **Example 1: Standard Dinner Service**
```
Bill: $85.50
Guest writes: "$95.00" (tip: $9.50)
Staff enters: $9.50 in "Guest Signed Tip"
Stripe processes: $95.00 total
```

### **Example 2: Large Party**
```
Bill: $234.80
Guest writes: "$280.00" (tip: $45.20)
Staff enters: $45.20 in "Guest Signed Tip"
Payment processed: $280.00 total
```

### **Example 3: Cash Payment**
```
Bill: $42.75
Guest pays: $50.00 cash (tip: $7.25)
Staff selects: Cash payment
Enters tip: $7.25
Records: $50.00 total received
```

## **📊 Benefits for Restaurant Operations**

### **Accurate Tip Tracking**
- **Exact amounts** guest intended to tip
- **No guessing** or standard percentages
- **Proper payroll** calculations

### **Audit Trail**
- **Complete records** in Stripe and PocketBase
- **Tip breakdown** stored with each transaction
- **Easy reporting** for taxes and payroll

### **Staff Flexibility**
- **Any role** can close tables when needed
- **Backup coverage** during busy periods
- **Manager override** available always

### **Customer Satisfaction**
- **Honor guest intentions** for tip amounts
- **Fast, professional** payment processing
- **Multiple payment methods** supported

## **🔒 Security & Compliance**

### **PCI Compliance**
- **Card data never stored** in PARC system
- **Stripe handles** all sensitive information
- **Zero liability** for card data breaches

### **Tip Accuracy**
- **Staff accountability** for tip entry
- **Receipt matching** with guest signatures
- **Clear audit trail** for all transactions

## **🚀 Testing the Workflow**

### **Development Testing**
1. **Start PARC**: `pnpm dev`
2. **Create test order** on any table
3. **Try guest signed tip**: Enter $5.00
4. **Use test card**: `4242424242424242`
5. **Verify completion**: Table clears, payment recorded

### **Stripe Test Cards**
- **Success**: `4242424242424242`
- **Declined**: `4000000000000002`
- **Insufficient Funds**: `4000000000009995`

---

**This workflow matches real restaurant operations exactly!** 🍽️

Staff can handle any payment scenario while maintaining accurate tip records and providing excellent customer service.
