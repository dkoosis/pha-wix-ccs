// src/backend/data.js
// Data hooks for collections - handles approval workflow

import wixData from 'wix-data';
import { contacts } from 'wix-crm-backend';
import { authentication, members, authorization } from 'wix-members-backend';

// Role IDs from the workflow document
const ROLE_IDS = {
    SITE_MEMBER: '2ade445c-7265-420a-8102-484abdd3dc54',
    CCS_INVITEE: '4ecb331a-1566-4879-9112-65103b74dd70',
    CCS_MEMBER: 'ad647c5b-efc7-4c21-b196-376d6ccd85b8',
    CCS_APPLICANT: 'f3f8ed52-8f27-42dc-9265-97b5d5bb2125' // (Ignored)
};

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
 * AfterUpdate hook for StudioMembershipApplications collection
 * Implements Phase 2: Manual Approval & Member Creation
 */
export async function StudioMembershipApplications_afterUpdate(item, context) {
    // Only proceed if status was just changed to "Approved"
    if (item.status !== 'Approved') {
        return item;
    }
    
    // Check if we already have a member linked (prevent duplicate processing)
    // TODO: Change this field check to 'wixMemberId' when schema is updated
    if (item.applicantProfile) {
        console.log(`Application ${item._id} already has a linked member`);
        return item;
    }
    
    console.log(`Processing approval for application ${item._id} from ${item.email}`);
    
    try {
        let memberId;
        let isNewMember = false;
        let needsPasswordEmail = false;
        
        // Step 2A: Check if user is already a Member
        console.log('Checking for existing member...');
        const existingMembers = await members.queryMembers()
            .eq('loginEmail', item.email)
            .find({ suppressAuth: true });
            
        if (existingMembers.items.length > 0) {
            // User is already a member
            memberId = existingMembers.items[0]._id;
            console.log(`Found existing member: ${memberId}`);
            isNewMember = false;
            needsPasswordEmail = false;
            
        } else {
            // Step 2B: Check if user is an existing Contact
            console.log('No member found. Checking for existing contact...');
            const existingContacts = await contacts.queryContacts()
                .eq('info.emails.email', item.email)
                .limit(1)
                .find({ suppressAuth: true });
                
            if (existingContacts.items.length > 0) {
                // User exists as contact - upgrade to member
                const contact = existingContacts.items[0];
                console.log(`Found existing contact: ${contact._id}. Upgrading to member...`);
                
                const registrationResult = await authentication.register(
                    item.email,
                    generateTempPassword(),
                    {
                        contactInfo: {
                            contactId: contact._id,
                            firstName: item.firstName || contact.info.name?.first || '',
                            lastName: item.lastName || contact.info.name?.last || ''
                        }
                    }
                );
                
                memberId = registrationResult.member._id;
                isNewMember = true;
                needsPasswordEmail = true;
                console.log(`Created member from contact: ${memberId}`);
                
            } else {
                // Step 2C: Completely new user
                console.log('No existing contact or member. Creating new member...');
                
                const registrationResult = await authentication.register(
                    item.email,
                    generateTempPassword(),
                    {
                        contactInfo: {
                            firstName: item.firstName || '',
                            lastName: item.lastName || ''
                        }
                    }
                );
                
                memberId = registrationResult.member._id;
                isNewMember = true;
                needsPasswordEmail = true;
                console.log(`Created new member: ${memberId}`);
            }
        }
        
        // Step 3: Link Application to Member
        // Using suppressHooks to prevent infinite loop
        console.log(`Linking application to member ${memberId}...`);
        
        // TODO: Change 'applicantProfile' to 'wixMemberId' when schema is updated
        await wixData.update('StudioMembershipApplications', {
            ...item,
            applicantProfile: memberId, // TODO: Rename to wixMemberId
            approvalDate: new Date()
        }, { suppressHooks: true });
        
        // Step 4: Assign Invitee Role
        console.log(`Assigning CCS_Invitee role to member ${memberId}...`);
        await authorization.assignRole(ROLE_IDS.CCS_INVITEE, memberId, { suppressAuth: true });
        
        // Step 5: Notify User of Approval
        if (needsPasswordEmail) {
            // New member - send password setup email
            console.log('Sending password setup email...');
            await authentication.sendSetPasswordEmail(item.email);
            
            // TODO: Also send "application approved" email once configured
            // await contacts.emailContact(contactId, { emailId: 'application_approved_new_member' });
            
        } else {
            // Existing member - send approval notification only
            console.log('Member already exists, sending approval notification...');
            
            // TODO: Configure and send "application approved" triggered email
            // Need to get the contact ID first
            // const contactQuery = await contacts.queryContacts()
            //     .eq('info.emails.email', item.email)
            //     .find({ suppressAuth: true });
            // if (contactQuery.items.length > 0) {
            //     await contacts.emailContact(contactQuery.items[0]._id, { 
            //         emailId: 'application_approved_existing_member' 
            //     });
            // }
        }
        
        console.log(`✅ Successfully processed approval for ${item.email}`);
        
    } catch (error) {
        console.error(`Error processing approval for application ${item._id}:`, error);
        // Don't throw error - we don't want to break the update
        // TODO: Consider adding an 'approvalError' field to track failed approvals
    }
    
    return item;
}

/**
 * AfterUpdate hook for MemberProfiles collection
 * Implements Phase 4: Final Promotion to Full Member
 */
export async function MemberProfiles_afterUpdate(item, context) {
    // Only proceed if inviteeStatus was just changed to "Promoted"
    if (item.inviteeStatus !== 'Promoted') {
        return item;
    }
    
    const memberId = item._id; // MemberProfiles uses member ID as _id
    console.log(`Processing promotion to full member for ${memberId}`);
    
    try {
        // Remove Invitee role
        console.log('Removing CCS_Invitee role...');
        await authorization.removeRole(ROLE_IDS.CCS_INVITEE, memberId, { suppressAuth: true });
        
        // Assign Full Member role
        console.log('Assigning CCS_Member role...');
        await authorization.assignRole(ROLE_IDS.CCS_MEMBER, memberId, { suppressAuth: true });
        
        // Send congratulations email
        // TODO: Configure and send "welcome to full membership" triggered email
        // const member = await members.getMember(memberId);
        // const contactQuery = await contacts.queryContacts()
        //     .eq('info.emails.email', member.loginEmail)
        //     .find({ suppressAuth: true });
        // if (contactQuery.items.length > 0) {
        //     await contacts.emailContact(contactQuery.items[0]._id, { 
        //         emailId: 'full_membership_welcome' 
        //     });
        // }
        
        console.log(`✅ Successfully promoted member ${memberId} to full membership`);
        
    } catch (error) {
        console.error(`Error promoting member ${memberId}:`, error);
        // Don't throw error - we don't want to break the update
    }
    
    return item;
}