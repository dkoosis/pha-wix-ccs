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
      const html = "<p style=\"text-align: left; line-height: 1.5em\" class=\"so-global-p1\"><span style=\"line-height: 1.5em\"><span style=\"font-style: normal\">Hi there,</span></span></p><p style=\"text-align: left; line-height: 1.5em\" class=\"so-global-p1\"><span style=\"line-height: 1.5em\"><br><span style=\"font-style: normal\">Thank you for placing your order with Powerhouse Ceramics. Here’s a quick summary of your order:</span><br>&nbsp;</span></p><p style=\"text-align: left; line-height: 1.5em; font-size: 16px\" class=\"so-global-p1\"><span style=\"font-size: 16px\"><span style=\"line-height: 1.5em\"><span style=\"font-weight: bold\"><span style=\"font-style: normal\">Order Date:</span></span><span style=\"font-style: normal\">&nbsp;<bdi>${orderDate}</bdi>&nbsp;</span><br><span style=\"font-weight: bold\"><span style=\"font-style: normal\">Order Number:</span></span><span style=\"font-style: normal\">&nbsp;<bdi>${orderNumber}</bdi>&nbsp;</span><br><br><span style=\"font-weight: bold\">Name:</span> <bdi>${customerName}</bdi>&nbsp;<br><span style=\"font-weight: bold\">Company Name:</span> <bdi>${companyName}</bdi>&nbsp;<br><span style=\"font-weight: bold\">Email Address:</span> <bdi>${customerEmailAddress}</bdi>&nbsp;<br><span style=\"font-weight: bold\">Phone Number:</span> <bdi>${customerPhoneNumber}</bdi>&nbsp;<br><br><span style=\"font-weight: bold\"><span style=\"font-style: normal\">Item Name:</span></span><span style=\"font-style: normal\"> <bdi>${itemName}</bdi>&nbsp;</span><br><span style=\"font-weight: bold\"><span style=\"font-style: normal\">Item Description:</span></span><span style=\"font-style: normal\"> <bdi>${itemDescription}</bdi>&nbsp;</span><br><span style=\"font-weight: bold\"><span style=\"font-style: normal\">Item Quantity:</span></span><span style=\"font-style: normal\"> <bdi>${itemQuantity}</bdi>&nbsp;</span><br><span style=\"font-weight: bold\"><span style=\"font-style: normal\">Item Price:</span></span><span style=\"font-style: normal\"> <bdi>${itemPrice}</bdi>&nbsp;</span><br><br><span style=\"font-weight: bold\">Order Subtotal:</span> <bdi>${orderSubtotal}</bdi>&nbsp;<br><span style=\"font-weight: bold\">Taxes:</span> <bdi>${tax}</bdi>&nbsp;<br><span style=\"font-weight: bold\"><span style=\"font-style: normal\">Order Total Amount:</span></span><span style=\"font-style: normal\"> <bdi>${orderTotalAmount}</bdi>&nbsp;</span></span></span></p>"
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
