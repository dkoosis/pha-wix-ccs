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
export async function findOrCreateMember(contactId, email) {
    if (!contactId || !email) {
        throw new Error("Both contactId and email are required");
    }

    console.log(`[MEMBER] Looking for member with email: ${email}`);

    try {
        // First, check if member exists by email using members API
        // TODO: Verify 'loginEmail' is the correct field name for queryMembers API
        // Original code might have queried the collection directly instead
        const memberQuery = await elevate(queryMembers)()
            .eq('loginEmail', email)
            .find();

        if (memberQuery.items.length > 0) {
            const existingMember = memberQuery.items[0];
            console.log(`[MEMBER] Found existing member: ${existingMember._id}`);
            
            // Check if member has a profile record
            const profileExists = await checkMemberProfile(existingMember._id);
            
            return {
                memberId: existingMember._id,
                isNew: false,
                hasProfile: profileExists,
                member: existingMember
            };
        }

        // Register new member
        console.log(`[MEMBER] No existing member found. Registering new member...`);
        const tempPassword = generateTempPassword();
        
        const registrationResult = await register(email, tempPassword, {
            contactInfo: { 
                contactId: contactId 
            }
        });
        
        const newMember = registrationResult.member;
        console.log(`[MEMBER] Created new member with ID: ${newMember._id}`);

        // Send password setup email (non-blocking)
        sendSetPasswordEmail(email)
            .then(() => console.log(`[MEMBER] Password setup email sent to ${email}`))
            .catch(err => console.error(`[MEMBER] Failed to send password email to ${email}:`, err));

        return {
            memberId: newMember._id,
            isNew: true,
            hasProfile: false, // New members don't have profiles yet
            member: newMember
        };

    } catch (error) {
        console.error("[MEMBER] Error in findOrCreateMember:", error);
        
        // Handle the case where member exists but query failed
        // TODO: String matching on error messages is brittle - need better approach
        // Wix might change error message text in future
        if (error.message && error.message.includes("already a site member")) {
            console.error(`[MEMBER] Critical: Member exists but couldn't be queried. Email: ${email}`);
            // Return a pending ID so we can still create the application
            return {
                memberId: `pending_${Date.now()}`,
                isNew: false,
                hasProfile: false,
                error: "Member exists but query failed"
            };
        }
        
        throw new Error(`Failed to find or create member: ${error.message}`);
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