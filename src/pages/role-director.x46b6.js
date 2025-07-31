// API Reference: https://www.wix.com/velo/reference/api-overview/introduction
// This code redirects users to appropriate subscription plan pages based on their role.

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

// Simplified mapping for subscription plans only
const ROLE_TO_PAGE_MAP = new Map([
    [ROLES.CCS_MEMBER, "/p1"],        // Member plans
    [ROLES.LEGACY_CS_MEMBER, "/p1"],  // Same as CCS_MEMBER
    [ROLES.CCS_INVITEE, "/p2"],       // Invitee plans
    [ROLES.CCS_APPLICANT, "/p3"]      // Application status
    // CCS_ADMIN, SITE_MEMBER, and guests all go to default
]);

const ROLE_PRIORITY = [
    ROLES.CCS_MEMBER,
    ROLES.LEGACY_CS_MEMBER,
    ROLES.CCS_INVITEE,
    ROLES.CCS_APPLICANT,
    ROLES.SITE_MEMBER,
    ROLES.CCS_ADMIN
];

// Public subscription plans page
const DEFAULT_PAGE = "/p4";

$w.onReady(async function () {
    try {
        const member = await currentMember.getMember();
        
        if (!member) {
            // Not logged in - show public plans
            wixLocation.to(DEFAULT_PAGE);
            return;
        }

        const roles = await currentMember.getRoles();
        
        if (!roles || roles.length === 0) {
            // Logged in but no roles - show public plans
            wixLocation.to(DEFAULT_PAGE);
            return;
        }

        const roleIds = roles.map(role => role._id);
        const highestPriorityRoleId = ROLE_PRIORITY.find(roleId => roleIds.includes(roleId));
        
        if (highestPriorityRoleId && ROLE_TO_PAGE_MAP.has(highestPriorityRoleId)) {
            const destinationPage = ROLE_TO_PAGE_MAP.get(highestPriorityRoleId);
            wixLocation.to(destinationPage);
        } else {
            // Default to public plans for any unhandled cases
            wixLocation.to(DEFAULT_PAGE);
        }
        
    } catch (error) {
        console.error("Error during subscription plan redirect:", error);
        wixLocation.to(DEFAULT_PAGE);
    }
});