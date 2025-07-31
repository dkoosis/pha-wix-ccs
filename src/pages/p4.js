// ====================
// SHARED UTILITY (put this in each page or create a shared module)
// ====================
import { currentMember } from 'wix-members';
import wixLocation from 'wix-location';

const ROLES = {
    CCS_ADMIN: "c4b5c14b-0bf9-4095-ba9a-6e30b1ae5098",
    CCS_APPLICANT: "f3f8ed52-8f27-42dc-9265-97b5d5bb2125",
    CCS_INVITEE: "4ecb331a-1566-4879-9112-65103b74dd70",
    CCS_MEMBER: "ad647c5b-efc7-4c21-b196-376d6ccd85b8",
    SITE_MEMBER: "2ade445c-7265-420a-8102-484abdd3dc54",
    LEGACY_CS_MEMBER: "5293fdfd-d64d-4369-a62d-1005310f83c4"
};

async function protectPage(allowedRoles) {
    try {
        const member = await currentMember.getMember();
        if (!member) {
            wixLocation.to("/role-director");
            return false;
        }
        
        const roles = await currentMember.getRoles();
        if (!roles || roles.length === 0) {
            wixLocation.to("/role-director");
            return false;
        }
        
        const roleIds = roles.map(role => role._id);
        const hasAccess = allowedRoles.some(roleId => roleIds.includes(roleId));
        
        if (!hasAccess) {
            wixLocation.to("/role-director");
            return false;
        }
        
        return true; // User has access
    } catch (error) {
        console.error("Error checking page access:", error);
        wixLocation.to("/role-director");
        return false;
    }
}

// ====================
// PAGE P4 - Public Plans (No protection needed)
// ====================
$w.onReady(function () {
    // No protection - everyone can access public plans
    console.log("Showing public plans");
});