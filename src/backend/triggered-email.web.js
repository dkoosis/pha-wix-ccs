import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails } from "wix-crm-backend";
import { orders } from "wix-ecom-backend";
export const conditionallyApplyMemberDiscount = webMethod(
  Permissions.Anyone,
  async (order) => {
    try {
      const order = await orders.getOrder(
        "960f925b-c03f-49fd-95a4-6ea043353015"
      );
      console.log("order", order);

      triggeredEmails.emailContact(
        "Upm0b8C",
        "3309746b-fce6-4690-bad1-e9aa907b60d6",
        {
          variables: {
            receiptNumber: "123456",
            orderNumber: order._id,
            orderDate: "",
            customerName: "",
            companyName: "",
            customerEmailAddress: "",
            customerPhoneNumber: "",
            itemName: "",
            itemDescription: "",
            itemQuantity: "",
            itemPrice: "",
            orderSubtotal: "",
            tax: "",
            orderTotalAmount: "",
            items: html,
            paymentDate: "",
            paymentCard: "",
            paymentTotal: "",
            SITE_URL: "",
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  }
);
