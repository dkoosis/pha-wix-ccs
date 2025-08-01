/**
 * If the shopper is a Studio Member (has role CCS_Member), 
 * then apply the member discount to the shopping cart. 
 * Updated to use centralized constants.
 */
import { Permissions, webMethod } from "wix-web-module";
import { currentMember } from 'wix-members-backend';
import { currentCart } from 'wix-ecom-backend';
import { ROLES, DISCOUNTS } from 'public/constants.js';

export const conditionallyApplyMemberDiscount = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            const memberRoles = await currentMember.getRoles();
            console.log("member roles", memberRoles);

            const memberRoleIds = memberRoles.map((role) => role._id);
            const isStudioMember = memberRoleIds.includes(ROLES.CCS_MEMBER.ID);
            if (!isStudioMember) return;

            return await currentCart.updateCurrentCart({
                couponCode: DISCOUNTS.STUDIO_MEMBER_COUPON_CODE,
            })

        } catch (error) {
            console.log(error);
        }
    }
);
