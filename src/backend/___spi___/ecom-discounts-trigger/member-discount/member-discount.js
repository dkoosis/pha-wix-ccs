import * as ecomDiscountsTrigger from 'interfaces-ecommerce-v1-custom-trigger';
import { currentMember } from 'wix-members-backend';
import { ROLES, DISCOUNTS } from 'public/constants.js';

/**
 * Lists all custom triggers provided by your service plugin integration.
 * Updated to use centralized constants.
 */
export const listTriggers = async () => {
    console.log("list triggers called");
    return {
        customTriggers: [{
            _id: DISCOUNTS.STUDIO_MEMBER_ID,
            name: "Member Discount",
        }, ],
    };
};

/**
 * Retrieves eligible custom discount triggers based on the provided items.
 * Updated to use centralized constants.
 */
export const getEligibleTriggers = async (options, context) => {
    console.log("get eligible triggers called");
    
    const trigger = options.triggers.find(
        (trigger) =>
        trigger.customTrigger._id === DISCOUNTS.STUDIO_MEMBER_ID,
    );

    console.log("trigger", trigger);

    const memberRoles = await currentMember.getRoles();
    console.log("member roles", memberRoles);

    const memberRoleIds = memberRoles.map((role) => role._id);
    const isStudioMember = memberRoleIds.includes(ROLES.CCS_MEMBER.ID);
    
    // Trigger is eligible if user is a studio member
    let result;
    if (isStudioMember) {
        result = {
            eligibleTriggers: [{
                customTriggerId: DISCOUNTS.STUDIO_MEMBER_ID,
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
