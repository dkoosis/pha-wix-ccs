import { authorization } from 'wix-members-backend';
import {sendReciept} from 'backend/triggered-email.web'
export async function wixMembers_onMemberCreated(event) {
    const memberId = event.entity._id;
    await authorization.assignRole("2ade445c-7265-420a-8102-484abdd3dc54", memberId, {
        suppressAuth: true
    })
    console.log(`Member with member ID: ${memberId} created.`);
}

export function wixEcom_onOrderPaymentStatusUpdated(event) {
  const orderId = event.data.order._id;
  const currentPaymentStatus = event.data.order.paymentStatus;
  const previousPaymentStatus = event.data.previousPaymentStatus;
  const orderTotalPrice = event.data.order.priceSummary.totalPrice.amount;
  const eventId = event.metadata.id;
  if(currentPaymentStatus == "PAID") {
      sendReciept(orderId)
  }
}

