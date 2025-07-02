import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails } from "wix-crm-backend";
import { orders } from "wix-ecom-backend";

export const conditionallyApplyMemberDiscount = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const order = await orders.getOrder("960f925b-c03f-49fd-95a4-6ea043353015");
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
      // const html = `
      //   <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
      //     <thead>
      //       <tr style="background-color:#f2f2f2;">
      //         <th>Product</th>
      //         <th>Quantity</th>
      //         <th>Price</th>
      //       </tr>
      //     </thead>
      //     <tbody>
      //       ${order.lineItems
      //         .map(
      //           item => `
      //         <tr>
      //           <td>${item.productName.translated}</td>
      //           <td>${item.quantity}</td>
      //           <td>${item.price.formattedAmount}</td>
      //         </tr>
      //       `
      //         )
      //         .join("")}
      //     </tbody>
      //   </table>
      // `;
      const html = "<table border=\\\"1\\\" cellpadding=\\\"8\\\" cellspacing=\\\"0\\\" style=\\\"border-collapse:collapse; width:100%;\\\">\\n<thead>\\n<tr style=\\\"background-color:#f2f2f2;\\\">\\nProduct\\nQuantity\\nPrice\\n</tr>\\n</thead>\\n<tbody>\\n\\n<tr>\\n<td>Ceramic 3D Printing with Nicolas Touron</td>\\n<td>1</td>\\n<td>$980.00</td>\\n</tr>\\n\\n</tbody>\\n</table>\"
   // Trigger the email
      await triggeredEmails.emailContact(
        "Upm0b8C", // Triggered email ID
        "e5c337b1-d023-417f-abf8-e6db82cf5f6c",
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
