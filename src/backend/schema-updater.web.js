// src/backend/schema-updater.web.js
import { collections } from 'wix-data.v2';
import { elevate } from 'wix-auth';
import { currentMember } from 'wix-members-backend';

const COLLECTION_ID = 'StudioMembershipApplications';

// Check if user is admin
async function isAdmin() {
    const member = await currentMember.getMember();
    if (!member) return false;
    
    const roles = await currentMember.getRoles();
    return roles.some(role => 
        role.name === 'Admin' || 
        role._id === 'c4b5c14b-0bf9-4095-ba9a-6e30b1ae5098' // CCS_ADMIN
    );
}

export async function updateSchema() {
    // Security check
    if (!await isAdmin()) {
        throw new Error('Admin access required');
    }
    
    try {
        console.log(`Starting schema replacement for ${COLLECTION_ID}...`);
        
        const getCollection = elevate(collections.getDataCollection);
        const currentCollection = await getCollection(COLLECTION_ID);
        
        if (!currentCollection) {
            throw new Error(`Collection ${COLLECTION_ID} not found`);
        }
        
        console.log(`Current revision: ${currentCollection.revision}`);
        
        // Define the new schema inline
        const newFields = [
            // Basic Information (7)
            { key: 'title', type: 'TEXT', displayName: 'Application Title', required: false },
            { key: 'firstName', type: 'TEXT', displayName: 'First Name', required: true },
            { key: 'lastName', type: 'TEXT', displayName: 'Last Name', required: true },
            { key: 'email', type: 'TEXT', displayName: 'Email', required: true },
            { key: 'phoneNumber', type: 'TEXT', displayName: 'Phone Number', required: false },
            { key: 'website', type: 'URL', displayName: 'Website', required: false },
            { key: 'instagramHandle', type: 'TEXT', displayName: 'Instagram Handle', required: false },
            
            // Address (4)
            { key: 'street', type: 'TEXT', displayName: 'Street Address', required: false },
            { key: 'city', type: 'TEXT', displayName: 'City', required: false },
            { key: 'state', type: 'TEXT', displayName: 'State/Province', required: false },
            { key: 'zipCode', type: 'TEXT', displayName: 'Zip/Postal Code', required: false },
            
            // Experience (6)
            { key: 'hasIndependentExperience', type: 'BOOLEAN', displayName: 'Has Independent Clay Experience', required: false },
            { key: 'experienceDescription', type: 'TEXT', displayName: 'Experience Description', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'knowsSafety', type: 'BOOLEAN', displayName: 'Familiar with Health & Safety', required: false },
            { key: 'safetyDescription', type: 'TEXT', displayName: 'Safety Procedures Description', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'studioTechniques', type: 'ARRAY_STRING', displayName: 'Studio Techniques', required: false },
            { key: 'practiceDescription', type: 'TEXT', displayName: 'Studio Practice Description', required: false, stringLengthRange: { maxLength: 3000 } },
            
            // Community (5)
            { key: 'studioSpaceType', type: 'TEXT', displayName: 'Studio Space Type', required: false },
            { key: 'communityGoalsSupport', type: 'TEXT', displayName: 'How to Support Community Goals', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'communityInterests', type: 'TEXT', displayName: 'Community Interests & Contribution', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'howHeardAbout', type: 'TEXT', displayName: 'How Heard About Studio', required: false },
            { key: 'questionsComments', type: 'TEXT', displayName: 'Questions or Comments', required: false, stringLengthRange: { maxLength: 2000 } },
            
            // Accessibility
            { key: 'accessibilityNote', type: 'TEXT', displayName: 'Accessibility Accommodations Needed', required: false, stringLengthRange: { maxLength: 2000 } },
            
            // Meta & Application Processing
            { key: 'submissionId', type: 'TEXT', displayName: 'Fillout Submission ID', required: false },
            { key: 'enrichmentInfo', type: 'TEXT', displayName: 'Enrichment Info', required: false, stringLengthRange: { maxLength: 3000 } },
            { key: 'status', type: 'TEXT', displayName: 'Application Status', required: false },
            { key: 'submissionDate', type: 'DATETIME', displayName: 'Submission Date', required: false },
            { key: 'newsletterOptIn', type: 'BOOLEAN', displayName: 'Newsletter Opt-In', required: false },
            
            // Approval Process
            { key: 'approvalDate', type: 'DATETIME', displayName: 'Approval Date', required: false },
            { key: 'approvalNotes', type: 'TEXT', displayName: 'Approval Notes', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'approvedBy', type: 'TEXT', displayName: 'Approved By (Email)', required: false },
            
            // Rejection Process  
            { key: 'rejectionDate', type: 'DATETIME', displayName: 'Rejection Date', required: false },
            { key: 'rejectionNotes', type: 'TEXT', displayName: 'Rejection Notes', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'rejectedBy', type: 'TEXT', displayName: 'Rejected By (Email)', required: false },
            
            // Wix Integration IDs
            { key: 'wixContactId', type: 'TEXT', displayName: 'Linked Wix Contact ID', required: false },
            { key: 'wixMemberId', type: 'TEXT', displayName: 'Linked Wix Member ID', required: false }
        ];
        
        const updatedCollection = {
            _id: COLLECTION_ID,
            displayName: 'Studio Membership Applications',
            displayField: 'title',
            fields: newFields,
            permissions: {
                insert: 'ANYONE',
                read: 'ADMIN',
                update: 'ADMIN',
                remove: 'ADMIN'
            },
            revision: currentCollection.revision,
            plugins: currentCollection.plugins || []
        };
        
        const updateCollection = elevate(collections.updateDataCollection);
        const result = await updateCollection(updatedCollection);
        
        console.log('✅ Schema replacement completed successfully!');
        console.log(`New revision: ${result.revision}`);
        console.log(`Total fields: ${result.fields.length}`);
        
        return {
            success: true,
            oldRevision: currentCollection.revision,
            newRevision: result.revision,
            fieldsCount: result.fields.length
        };
        
    } catch (error) {
        console.error('❌ Failed to replace collection schema:', error);
        return {
            success: false,
            error: error.message,
            details: error
        };
    }
}