// src/backend/data.js
// Data hooks with wixMemberId field name

import wixData from 'wix-data';
import { contacts } from 'wix-crm-backend';
import { authentication, members, authorization } from 'wix-members-backend';

const ROLE_IDS = {
    SITE_MEMBER: '2ade445c-7265-420a-8102-484abdd3dc54',
    CCS_INVITEE: '4ecb331a-1566-4879-9112-65103b74dd70',
    CCS_MEMBER: 'ad647c5b-efc7-4c21-b196-376d6ccd85b8',
    CCS_APPLICANT: 'f3f8ed52-8f27-42dc-9265-97b5d5bb2125',
    CCS_ADMIN: 'c4b5c14b-0bf9-4095-ba9a-6e30b1ae5098' // Studio staff admin

};

function generateTempPassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 16; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

export async function StudioMembershipApplications_afterUpdate(item, context) {
    if (item.status !== 'Approved') {
        return item;
    }
    
    if (item.wixMemberId) {
        console.log(`Application ${item._id} already has a linked member`);
        return item;
    }
    
    console.log(`Processing approval for application ${item._id} from ${item.email}`);
    
    try {
        let memberId;
        let isNewMember = false;
        let needsPasswordEmail = false;
        
        console.log('Checking for existing member...');
        const existingMembers = await members.queryMembers()
            .eq('loginEmail', item.email)
            .find({ suppressAuth: true });
            
        if (existingMembers.items.length > 0) {
            memberId = existingMembers.items[0]._id;
            console.log(`Found existing member: ${memberId}`);
            isNewMember = false;
            needsPasswordEmail = false;
            
        } else {
            console.log('No member found. Checking for existing contact...');
            const existingContacts = await contacts.queryContacts()
                .eq('info.emails.email', item.email)
                .limit(1)
                .find({ suppressAuth: true });
                
            if (existingContacts.items.length > 0) {
                const contact = existingContacts.items[0];
                console.log(`Found existing contact: ${contact._id}. Upgrading to member...`);
                
                const registrationResult = await authentication.register(
                    item.email,
                    generateTempPassword(),
                    {
                        contactInfo: {
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
        
        console.log(`Linking application to member ${memberId}...`);
        
        await wixData.update('StudioMembershipApplications', {
            ...item,
            wixMemberId: memberId,
            approvalDate: new Date()
        }, { suppressHooks: true });
        
        console.log(`Assigning CCS_Invitee role to member ${memberId}...`);
        await authorization.assignRole(ROLE_IDS.CCS_INVITEE, memberId, { suppressAuth: true });
        
        if (needsPasswordEmail) {
            console.log('Sending password setup email...');
            await authentication.sendSetPasswordEmail(item.email);
        } else {
            console.log('Member already exists, sending approval notification...');
        }
        
        console.log(`✅ Successfully processed approval for ${item.email}`);
        
    } catch (error) {
        console.error(`Error processing approval for application ${item._id}:`, error);
    }
    
    return item;
}

export async function MemberProfiles_afterUpdate(item, context) {
    if (item.inviteeStatus !== 'Promoted') {
        return item;
    }
    
    const memberId = item._id;
    console.log(`Processing promotion to full member for ${memberId}`);
    
    try {
        console.log('Removing CCS_Invitee role...');
        await authorization.removeRole(ROLE_IDS.CCS_INVITEE, memberId, { suppressAuth: true });
        
        console.log('Assigning CCS_Member role...');
        await authorization.assignRole(ROLE_IDS.CCS_MEMBER, memberId, { suppressAuth: true });
        
        console.log(`✅ Successfully promoted member ${memberId} to full membership`);
        
    } catch (error) {
        console.error(`Error promoting member ${memberId}:`, error);
    }
    
    return item;
}