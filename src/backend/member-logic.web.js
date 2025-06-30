// src/backend/member-logic.web.js
// Site Member management logic with race condition prevention

import { authentication, currentMember, members } from 'wix-members-backend';

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
 * 
 * NOTE: This function is now primarily used by the data hook during
 * the approval process, not during initial application submission.
 *
 * @param {object} contactInfo - A Wix CRM contact object.
 * @returns {Promise<{member: object, wasCreated: boolean}>}
 */
export async function findOrCreateMember(contactInfo) {
    // Validate input - using correct Wix CRM contact structure
    if (!contactInfo || !contactInfo.info?.emails?.[0]?.email) {
        throw new Error("Contact info with a valid email is required to create a member.");
    }

    const email = contactInfo.info.emails[0].email;
    const registrationOptions = {
        contactInfo: {
            contactId: contactInfo._id,  // Include the contact ID for linking
            firstName: contactInfo.info.name?.first || '',
            lastName: contactInfo.info.name?.last || ''
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
            
            const existingMembers = await members.queryMembers()
                .eq("loginEmail", email)
                .find({ suppressAuth: true });

            if (existingMembers.items.length > 0) {
                console.log(`Found existing member: ${existingMembers.items[0]._id}`);
                return { member: existingMembers.items[0], wasCreated: false };
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