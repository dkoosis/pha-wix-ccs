// Run this in the Wix Backend Testing Console
// Go to: Wix Dashboard → Settings → Developer Tools → Backend Testing

import { testFiringSlip, findRecentFiringOrders } from 'backend/test-firing.web';

// Step 1: Find recent orders with firing items
console.log("Searching for recent firing orders...");
const recentOrders = await findRecentFiringOrders(20);

if (recentOrders.length > 0) {
  console.log(`Found ${recentOrders.length} orders with firing items:`);
  recentOrders.forEach((order, index) => {
    console.log(`${index + 1}. Order #${order.orderNumber} (${order.orderDate})`);
    console.log(`   Status: ${order.paymentStatus}`);
    console.log(`   Customer: ${order.customerName}`);
    console.log(`   Firing Items: ${order.firingItemsCount} - ${order.firingItems}`);
    console.log(`   Order ID: ${order.orderId}`);
    console.log('---');
  });
  
  // Step 2: Test with the most recent PAID order
  const paidOrders = recentOrders.filter(o => o.paymentStatus === 'PAID');
  if (paidOrders.length > 0) {
    const testOrder = paidOrders[0];
    console.log(`\nTesting with order #${testOrder.orderNumber}...`);
    const result = await testFiringSlip(testOrder.orderId);
    console.log("Test result:", result);
  } else {
    console.log("\nNo PAID orders found. Select an order ID from above and run:");
    console.log("await testFiringSlip('ORDER_ID_HERE')");
  }
} else {
  console.log("No recent orders with firing items found.");
  console.log("You can still test with a specific order ID if you have one:");
  console.log("await testFiringSlip('YOUR_ORDER_ID')");
}
