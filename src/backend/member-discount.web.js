/**
 * If the shoper is a Studio Member (has role CCS_Member), 
 * then apply the member discount to the shopping cart. 
 * The CCS_Memeber role and the STUDIOMEMBER coupon are set in the interface.
 * TODO: delete console statements for deployment?
 * dk! 
 */
import { Permissions, webMethod } from "wix-web-module";
import { currentMember } from 'wix-members-backend';
import { currentCart } from 'wix-ecom-backend';

const STUDIO_MEMBER_ROLE_ID = "ad647c5b-efc7-4c21-b196-376d6ccd85b8"; 
const STUDIO_MEMBER_DISCOUNT_COUPON_CODE = "STUDIOMEMBER";

export const conditionallyApplyMemberDiscount = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            const memberRoles = await currentMember.getRoles();
            console.log("member roles", memberRoles);

            const memberRoleIds = memberRoles.map((role) => role._id);
            const isStudioMember = memberRoleIds.includes(STUDIO_MEMBER_ROLE_ID);
            if (!isStudioMember) return;

            return await currentCart.updateCurrentCart({
                couponCode: STUDIO_MEMBER_DISCOUNT_COUPON_CODE,
            })

        } catch (error) {
            console.log(error);
        }

    }
);