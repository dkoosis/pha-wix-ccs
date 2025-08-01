import wixMembers from 'wix-members';
import { ROLES } from 'public/constants.js';

$w.onReady(async function () {
    if (!wixMembers.authentication.loggedIn()) {
        $w('#publicServices').expand()
        return
    } else {
        const roles = await wixMembers.currentMember.getRoles()
        const roleIds = roles.map(role => role._id);
        
        // Use centralized constants and hierarchical logic
        const isStudioMember = roleIds.includes(ROLES.CCS_MEMBER.ID);
        const isInvitee = roleIds.includes(ROLES.CCS_INVITEE.ID);
        const isSiteMember = roleIds.includes(ROLES.SITE_MEMBER.ID);
        
        if (isStudioMember) {
            // Studio members see all services
            $w('#publicServices').expand();
            $w('#inviteeServices').expand();
            $w('#allServices').expand();
        } else if (isInvitee) {
            // Invitees see public + invitee services
            $w('#publicServices').expand();
            $w('#inviteeServices').expand();
            $w('#allServices').collapse();
        } else {
            // Site members and others see only public services
            $w('#publicServices').expand();
            $w('#inviteeServices').collapse();
            $w('#allServices').collapse();
        }
    }
});
