// src/backend/member-logic.web.js
// Site Member management logic
// TODO: Verify elevate() usage pattern - some operations use elevate(), others use suppressAuth

import { register, sendSetPasswordEmail, queryMembers } from 'wix-members-backend';
import { elevate } from 'wix-auth';
import wixData from 'wix-data';

const MEMBERS_COLLECTION = 'Members/PrivateMembersData';

/**
 * Generate a temporary password for new member registration
 */
function generateTempPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

/**
 * Find or create a site member
 */
// src/backend/member-logic.web.js

import { members } from 'wix-members-backend';

/**
 * Creates a Wix Site Member from contact info, handling cases where the member already exists.
 * This is the recommended "try-to-create, then-catch-duplicate" pattern.
 *
 * @param {object} contactInfo - A Wix CRM contact object.
 * @returns {Promise<{member: object, wasCreated: boolean}>}
 */
export async function findOrCreateMember(contactInfo) {
    if (!contactInfo || !contactInfo.info.emails[0].email) {
        throw new Error("Contact info with a valid email is required to create a member.");
    }

    const memberInfo = {
        contactInfo: {
            firstName: contactInfo.info.name.first,
            lastName: contactInfo.info.name.last,
            emails: [{ email: contactInfo.info.emails[0].email, tag: "MAIN" }]
        }
    };

    try {
        // Velo Best Practice: Directly attempt to create the member.
        // This is more robust than checking for existence first.
        const member = await members.createMember(memberInfo);
        return { member, wasCreated: true };

    } catch (error) {
        // Velo Best Practice: Catch specific errors. If the member already exists,
        // Wix will throw an error. We catch it and retrieve the existing member.
        // Note: You should confirm the exact error code from Wix documentation or testing.
        // 'wix-members-backend_member-already-exists' is a likely candidate.
        if (error.message.includes("member already exists")) { // A common error signature
            
            // If the member exists, fetch their data using their email.
            const existingMember = await members.getMemberByEmail(memberInfo.contactInfo.emails[0].email);
            return { member: existingMember, wasCreated: false };

        } else {
            // For any other unexpected error, log it and re-throw it so the
            // calling function knows something went wrong.
            console.error("An unexpected error occurred while creating a member:", error);
            throw error;
        }
    }
}

/**
 * Check if a member has a profile record
 */
async function checkMemberProfile(memberId) {
    try {
        // TODO: Verify behavior - does wixData.get throw error or return null for missing records?
        const profile = await wixData.get(MEMBERS_COLLECTION, memberId, { suppressAuth: true });
        return !!profile;
    } catch (error) {
        // Profile doesn't exist
        return false;
    }
}

/**
 * Create or update member profile
 */
export async function ensureMemberProfile(memberId, email) {
    if (!memberId || memberId.startsWith('pending_')) {
        console.log(`[MEMBER] Skipping profile creation for pending member: ${memberId}`);
        return null;
    }

    try {
        // Check if profile exists
        const existingProfile = await wixData.get(MEMBERS_COLLECTION, memberId, { suppressAuth: true })
            .catch(() => null);

        if (existingProfile) {
            console.log(`[MEMBER] Profile already exists for member: ${memberId}`);
            return existingProfile;
        }

        // Create new profile
        // TODO: Verify we can set _id when inserting into Members collection
        // Alternative might be to let Wix generate ID and link via different field
        const profile = {
            _id: memberId,
            loginEmail: email,
            studioApplications: [],
            memberStatus: 'active',
            registrationDate: new Date()
        };

        const newProfile = await wixData.insert(MEMBERS_COLLECTION, profile, { suppressAuth: true });
        console.log(`[MEMBER] Created profile for member: ${memberId}`);
        return newProfile;

    } catch (error) {
        console.error(`[MEMBER] Error creating profile for ${memberId}:`, error);
        throw error;
    }
}