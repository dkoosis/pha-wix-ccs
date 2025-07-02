import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails } from "wix-crm-backend";
import { orders } from "wix-ecom-backend";

export const sendReciept = webMethod(
  Permissions.Anyone,
  async (orderId) => {
    try {
      const order = await orders.getOrder(orderId);
      console.log("order", order);

      // Extract necessary fields
      const orderDate = new Date(order.purchasedDate).toLocaleDateString();
      const paymentDate = new Date(order.activities.find(a => a.type === "ORDER_PAID")?._createdDate || "").toLocaleDateString();
      const customerName = `${order.billingInfo.contactDetails.firstName} ${order.billingInfo.contactDetails.lastName}`;
      const customerEmail = order.buyerInfo.email;
      const customerPhone = order.billingInfo.contactDetails.phone;
      const receiptNumber = order.activities.find(a => a.type === "RECEIPT_CREATED")?.receiptCreated?.wixReceipt?.displayNumber || "";
      const companyName = ""; // Leave empty if not applicable
      const paymentCard = ""; // Leave empty if not retrievable
      const SITE_URL = "https://yourdomain.com"; // Replace with your actual site URL

      // Order pricing
      const subtotal = order.priceSummary.subtotal.formattedAmount;
      const tax = order.priceSummary.tax.formattedAmount;
      const total = order.priceSummary.total.formattedAmount;
      const paymentTotal = order.balanceSummary.paid.formattedAmount;

      // Build HTML table of items
      const html = `
            ${order.lineItems
              .map(
                (item,i) => `
               Item Name: ${item.productName.translated}
               Item Quantiy: ${item.quantity}
               Item Price: ${item.price.formattedAmount}
----------------------------------------------------------------------------------------------
            `
              )
              .join("")}
      `;
      
  // Trigger the email
      await triggeredEmails.emailContact(
        "Upm0b8C", // Triggered email ID
        "087762eb-1ce1-4854-99ce-f30da6c8630c",
        {
          variables: {
            receiptNumber,
            orderNumber: order._id,
            orderDate,
            customerName,
            companyName,
            customerEmailAddress: customerEmail,
            customerPhoneNumber: customerPhone,
            orderSubtotal: subtotal,
            tax,
            orderTotalAmount: total,
            items: html,
            paymentDate,
            paymentCard,
            paymentTotal,
            SITE_URL
          }
        }
      );

       await triggeredEmails.emailContact(
        "Upm0b8C", // Triggered email ID
        "0475997f-2ad0-4c89-85cb-7f82eb8f03a1",
        {
          variables: {
            receiptNumber,
            orderNumber: order._id,
            orderDate,
            customerName,
            companyName,
            customerEmailAddress: customerEmail,
            customerPhoneNumber: customerPhone,
            orderSubtotal: subtotal,
            tax,
            orderTotalAmount: total,
            items: html,
            paymentDate,
            paymentCard,
            paymentTotal,
            SITE_URL
          }
        }
      );

    } catch (error) {
      console.error("Error sending email:", error);
    }
  }
);
