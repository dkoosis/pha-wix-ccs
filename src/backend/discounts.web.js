import { Permissions, webMethod } from "wix-web-module";
import { discountRules } from "wix-ecom-backend";

export const getDiscounts = webMethod(
    Permissions.Anyone,
    () => {
        return queryDiscountRules();
    }
);

async function queryDiscountRules() {
    return await discountRules.queryDiscountRules().find();

}