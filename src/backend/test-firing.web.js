// Test file for debugging firing slip emails
import { Permissions, webMethod } from "wix-web-module";
import { orders } from "wix-ecom-backend";
import { sendFiringSlip } from "./triggered-email.web.js";

const FIRING_APP_ID = "97ed05e3-04ed-4095-af45-90587bfed9f0";

/**
 * Test function to manually trigger firing slip for a specific order
 * Call this from the Wix backend testing console or from a page
 */
export const testFiringSlip = webMethod(
  Permissions.Admin,  // Only admins can test
  async (orderId) => {
    console.log(`[TEST-FIRING] ====== Manual test started for order: ${orderId} ======`);
    
    try {
      // First, let's check if the order exists and has firing items
      const order = await orders.getOrder(orderId);
      console.log(`[TEST-FIRING] Order found: #${order.number}`);
      console.log(`[TEST-FIRING] Payment status: ${order.paymentStatus}`);
      console.log(`[TEST-FIRING] Total items: ${order.lineItems.length}`);
      
      // Check for firing items
      const firingItems = order.lineItems.filter(item => 
        item.catalogReference?.appId === FIRING_APP_ID
      );
      
      console.log(`[TEST-FIRING] Firing items found: ${firingItems.length}`);
      
      if (firingItems.length > 0) {
        console.log(`[TEST-FIRING] Firing items:`);
        firingItems.forEach((item, index) => {
          console.log(`[TEST-FIRING]   ${index + 1}. ${item.productName.translated}`);
        });
      }
      
      // Now try to send the firing slip
      console.log(`[TEST-FIRING] Calling sendFiringSlip...`);
      await sendFiringSlip(orderId);
      
      console.log(`[TEST-FIRING] ✓ Test completed successfully`);
      return {
        success: true,
        orderNumber: order.number,
        firingItemsCount: firingItems.length
      };
      
    } catch (error) {
      console.error(`[TEST-FIRING] ✗ Test failed:`, error.message);
      console.error(`[TEST-FIRING] Stack:`, error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }
);

/**
 * Find recent orders that have firing items
 * Useful for finding test orders
 */
export const findRecentFiringOrders = webMethod(
  Permissions.Admin,
  async (limit = 10) => {
    console.log(`[TEST-FIRING] Searching for recent orders with firing items...`);
    
    try {
      const queryResult = await orders.queryOrders()
        .limit(limit)
        .descending("_createdDate")
        .find();
      
      const ordersWithFiring = [];
      
      for (const order of queryResult.items) {
        const firingItems = order.lineItems.filter(item => 
          item.catalogReference?.appId === FIRING_APP_ID
        );
        
        if (firingItems.length > 0) {
          ordersWithFiring.push({
            orderId: order._id,
            orderNumber: order.number,
            orderDate: order._createdDate,
            paymentStatus: order.paymentStatus,
            customerName: `${order.billingInfo.contactDetails.firstName} ${order.billingInfo.contactDetails.lastName}`,
            firingItemsCount: firingItems.length,
            firingItems: firingItems.map(item => item.productName.translated).join(", ")
          });
        }
      }
      
      console.log(`[TEST-FIRING] Found ${ordersWithFiring.length} orders with firing items`);
      return ordersWithFiring;
      
    } catch (error) {
      console.error(`[TEST-FIRING] Failed to find orders:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
);
