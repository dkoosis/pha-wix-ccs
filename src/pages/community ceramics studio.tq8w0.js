//import { Permissions, webMethod } from "wix-web-module";
//import { currentMember } from 'wix-members-backend';
import { authentication } from 'wix-members-frontend';

const STUDIO_MEMBER_ROLE_ID = "ad647c5b-efc7-4c21-b196-376d6ccd85b8"; 

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
            const isStudioMember = memberRoleIds.includes(STUDIO_MEMBER_ROLE_ID);
            if (!isStudioMember) return;

            return await currentCart.updateCurrentCart({
                couponCode: STUDIO_MEMBER_DISCOUNT_COUPON_CODE,
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