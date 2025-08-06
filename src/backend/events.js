// src/backend/events.js - Updated to send firing slips
import { authorization } from 'wix-members-backend';
import { sendReceipt, sendFiringSlip } from 'backend/triggered-email.web'

/**
 * Handles new member creation - assigns default site member role
 */
export async function wixMembers_onMemberCreated(event) {
    const memberId = event.entity._id;
    await authorization.assignRole("2ade445c-7265-420a-8102-484abdd3dc54", memberId, {
        suppressAuth: true
    })
    console.log(`Member with member ID: ${memberId} created.`);
}

/**
 * Handles order payment status changes
 * When an order is paid:
 * 1. Sends customer receipt email
 * 2. Sends firing slips to printer (one per firing item)
 */
export function wixEcom_onOrderPaymentStatusUpdated(event) {
    const orderId = event.data.order._id;
    const orderNumber = event.data.order.number;
    const currentPaymentStatus = event.data.order.paymentStatus;
    const previousPaymentStatus = event.data.previousPaymentStatus;
    const orderTotalPrice = event.data.order.priceSummary.totalPrice.amount;
    const eventId = event.metadata.id;
    
    console.log(`[FIRING-EVENT] Payment status updated for Order #${orderNumber} (${orderId})`);
    console.log(`[FIRING-EVENT] Status: ${previousPaymentStatus} -> ${currentPaymentStatus}`);
    console.log(`[FIRING-EVENT] Total: ${orderTotalPrice}`);
    
    if(currentPaymentStatus == "PAID") {
        console.log(`[FIRING-EVENT] Order PAID - Triggering sendFiringSlip for Order #${orderNumber}`);
        
        // Send firing slip to printer
        // Use catch to prevent firing slip errors from breaking order flow
        sendFiringSlip(orderId)
            .then(result => {
                console.log(`[FIRING-EVENT] ✓ Firing slip sent successfully for Order #${orderNumber}`);
            })
            .catch(error => {
                console.error(`[FIRING-EVENT] ✗ Failed to send firing slip for Order #${orderNumber}:`, error.message);
                console.error(`[FIRING-EVENT] Error stack:`, error.stack);
            });
    } else {
        console.log(`[FIRING-EVENT] Order not paid (${currentPaymentStatus}) - Skipping firing slip`);
    }
}
