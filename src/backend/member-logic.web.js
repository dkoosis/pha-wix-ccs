// src/backend/member-logic.web.js
// Site Member management logic with race condition prevention

// Fix: Use v2 API
import { authentication, currentMember, members } from 'wix-members-backend.v2';

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
 * Creates a Wix Site Member from contact info using the robust
 * "try-to-create-first" pattern to avoid race conditions.
 * * NOTE: This function is now primarily used by the data hook during
 * the approval process, not during initial application submission.
 *
 * @param {object} contactInfo - A Wix CRM contact object.
 * @returns {Promise<{member: object, wasCreated: boolean}>}
 */
export async function findOrCreateMember(contactInfo) {
    // Validate input - v2 CRM contacts have primaryInfo.email
    if (!contactInfo || !contactInfo.primaryInfo?.email) {
        throw new Error("Contact info with a valid email is required to create a member.");
    }

    const email = contactInfo.primaryInfo.email;
    const registrationOptions = {
        contactInfo: {
            contactId: contactInfo._id,  // Include the contact ID for linking
            firstName: contactInfo.info?.name?.first || '',
            lastName: contactInfo.info?.name?.last || ''
        }
    };

    try {
        // BEST PRACTICE: Try to create first (avoids race conditions)
        console.log(`Attempting to register new member for: ${email}`);
        const registrationResult = await authentication.register(email, generateTempPassword(), registrationOptions);
        const newMember = registrationResult.member;
        console.log(`Successfully created new member with ID: ${newMember._id}`);

        // Send password setup email (non-blocking)
        authentication.sendSetPasswordEmail(email).catch(err => {
            console.error(`Non-critical error: Failed to send password setup email to ${email}:`, err);
        });

        return { member: newMember, wasCreated: true };

    } catch (error) {
        // Only query if registration failed due to existing member
        if (error.message && error.message.toLowerCase().includes("already")) {
            console.log(`Member with email ${email} already exists. Querying for existing member...`);
            
            // Fix: Use v2 API query builder pattern
            const existingMembersResult = await members.queryMembers()
                .eq('loginEmail', email)
                .limit(1)
                .find();

            if (existingMembersResult.items && existingMembersResult.items.length > 0) {
                console.log(`Found existing member: ${existingMembersResult.items[0]._id}`);
                return { member: existingMembersResult.items[0], wasCreated: false };
            } else {
                // Critical edge case: member exists but can't be found
                console.error(`FATAL: Member registration for ${email} failed, but could not find existing member.`);
                throw new Error(`Could not create or find member for ${email}. Database inconsistency detected.`);
            }
        }
        
        // Re-throw any other errors
        console.error("Unhandled error in findOrCreateMember:", error);
        throw error;
    }
}

// REMOVED: ensureMemberProfile function
// The Members/PrivateMembersData collection is read-only and managed by Wix.
// Member profiles are now tracked in a custom MemberProfiles collection as per
// the workflow document (Phase 3).