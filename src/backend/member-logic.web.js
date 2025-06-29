// src/backend/member-logic.web.js
// Site Member management logic with race condition prevention

import { register, sendSetPasswordEmail, queryMembers } from 'wix-members-backend';
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
 * Creates a Wix Site Member from contact info using the robust
 * "try-to-create-first" pattern to avoid race conditions.
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
        const registrationResult = await register(email, generateTempPassword(), registrationOptions);
        const newMember = registrationResult.member;
        console.log(`Successfully created new member with ID: ${newMember._id}`);

        // Send password setup email (non-blocking)
        sendSetPasswordEmail(email).catch(err => {
            console.error(`Non-critical error: Failed to send password setup email to ${email}:`, err);
        });

        return { member: newMember, wasCreated: true };

    } catch (error) {
        // Only query if registration failed due to existing member
        if (error.message && error.message.toLowerCase().includes("already")) {
            console.log(`Member with email ${email} already exists. Querying for existing member...`);
            
            const existingMembers = await queryMembers()
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

/**
 * Ensures a member has a profile in the PrivateMembersData collection using atomic upsert.
 * Uses wixData.save() to avoid race conditions.
 * 
 * @param {object} memberInfo The member object from wix-members-backend.
 * @returns {Promise<{success: boolean, memberProfile?: object, created?: boolean, error?: string}>}
 */
export async function ensureMemberProfile(memberInfo) {
    const options = { suppressAuth: true };
    const memberId = memberInfo._id;

    try {
        // BEST PRACTICE: Use save() for atomic upsert operation
        // This avoids the race condition of check-then-write
        const profileToSave = {
            _id: memberId,  // Required for save() to know whether to update or insert
            loginEmail: memberInfo.loginEmail,
            registrationDate: memberInfo.registrationDate || new Date(),
            // Add any other default fields you want for new profiles
            // Note: save() will NOT overwrite existing fields unless explicitly provided
        };

        const savedProfile = await wixData.save(MEMBERS_COLLECTION, profileToSave, options);
        console.log(`Ensured PrivateMembersData record for member ${memberId}`);
        
        // Note: wixData.save() doesn't tell us if it was an insert or update
        // If you need to know, you can check _createdDate vs _updatedDate
        const created = savedProfile._createdDate === savedProfile._updatedDate;
        
        return { 
            success: true, 
            memberProfile: savedProfile,
            created: created
        };

    } catch (error) {
        console.error(`Error ensuring member profile in PrivateMembersData for ${memberId}:`, error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}