//import { Permissions, webMethod } from "wix-web-module";
//import { currentMember } from 'wix-members-backend';
import { authentication } from 'wix-members-frontend';
import { ROLES } from 'public/constants.js';

$w.onReady(function () {
    renderUI();
    authentication.onLogin(renderUI);
    authentication.onLogout(renderUI);
/*
	// Write your Javascript code here using the Velo framework API

	// Print hello world:
	// console.log("Hello world!");

	// Call functions on page elements, e.g.:
	// $w("#button1").label = "Click me!";

	// Click "Run", or Preview your site, to execute your code


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
*/
});

function renderUI(params) {
    const isLoggedIn = authentication.loggedIn();
    if (isLoggedIn) {
        $w('#welcomeInvitee').expand();
        $w("#repeaterHome").collapse();
    } else {
        $w('#welcomeInvitee').collapse();
        $w("#repeaterHome").expand();
    }
}