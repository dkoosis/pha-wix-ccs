
import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails } from 'wix-crm';


export const conditionallyApplyMemberDiscount = webMethod(
    Permissions.Anyone,
    async (order) => {
        try {
         
triggeredEmails.emailContact('Upm0b8C', "3309746b-fce6-4690-bad1-e9aa907b60d6", {
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
        SITE_URL: ""
  }
});

        } catch (error) {
            console.log(error);
        }

    }
);
