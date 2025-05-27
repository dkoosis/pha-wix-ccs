import * as ecomDiscountsTrigger from 'interfaces-ecommerce-v1-custom-trigger';
import { currentMember } from 'wix-members-backend';

const STUDIO_MEMBER_DISCOUNT_ID = "d11eda27-4484-4eee-b2a9-13f72c49a277";
const STUDIO_MEMBER_ROLE_ID = "ad647c5b-efc7-4c21-b196-376d6ccd85b8";

/**
 * Lists all custom triggers provided by your service plugin integration.
 *
 * This method is automatically called by Wix eCommerce to populate the custom [minimum requirements section of an automatic discount](https://support.wix.com/en/article/wix-stores-creating-automatic-discounts#:~:text=Create%20minimum%20requirements).
 * @param {import('interfaces-ecommerce-v1-custom-trigger').Context} context
 * @returns {Promise<import('interfaces-ecommerce-v1-custom-trigger').ListTriggersResponse | import('interfaces-ecommerce-v1-custom-trigger').BusinessError>}
 */
export const listTriggers = async () => {
    console.log("list triggers called");
    return {
        customTriggers: [{
            _id: STUDIO_MEMBER_DISCOUNT_ID,
            name: "Member Discount",
        }, ],
    };
};

/**
 * Retrieves eligible custom discount triggers based on the provided items.
 *
 * This method is automatically called by Wix eCommerce to retrieve the custom discount triggers provided by your extension.
 * This happens when actions are performed on the cart and checkout entities/pages. For example, when an item is added to the cart.
 * @param {import('interfaces-ecommerce-v1-custom-trigger').GetEligibleTriggersOptions} options
 * @param {import('interfaces-ecommerce-v1-custom-trigger').Context} context
 * @returns {Promise<import('interfaces-ecommerce-v1-custom-trigger').GetEligibleTriggersResponse | import('interfaces-ecommerce-v1-custom-trigger').BusinessError>}
 */
export const getEligibleTriggers = async (options, context) => {
    console.log("get eligible triggers called");
    
    const trigger = options.triggers.find(
        (trigger) =>
        trigger.customTrigger._id === STUDIO_MEMBER_DISCOUNT_ID,
    );

    console.log("trigger", trigger);

    const memberRoles = await currentMember.getRoles();
    console.log("member roles", memberRoles);

    const memberRoleIds = memberRoles.map((role) => role._id);
    const isStudioMember = memberRoleIds.includes(STUDIO_MEMBER_ROLE_ID);
    // Trigger is eligible if the time is between 4-6pm
    let result;
    if (isStudioMember) {
        result = {
            eligibleTriggers: [{
                customTriggerId: STUDIO_MEMBER_DISCOUNT_ID,
                identifier: trigger.identifier,
            }, ],
        };
    } else {
        result = {
            eligibleTriggers: [],
        };
    }
    return result;
};