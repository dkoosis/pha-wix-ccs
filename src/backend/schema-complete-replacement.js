// src/backend/schema-complete-replacement.js
// Complete schema replacement with 28 essential fields

// IMPORTANT: collections API requires wix-data.v2 - this is NOT a style choice
// The collections schema management API is ONLY available in v2
// Do NOT change this import - it will break
import { collections } from 'wix-data.v2';
import { elevate } from 'wix-auth';

const COLLECTION_ID = 'StudioMembershipApplications';

function getCompleteSchema() {
    return {
        collectionId: COLLECTION_ID,
        displayName: 'Studio Membership Applications',
        displayField: 'title',
        permissions: {
            insert: 'ANYONE',
            read: 'ADMIN',
            update: 'ADMIN',
            remove: 'ADMIN'
        },
        fields: [
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
            // TAGS type doesn't exist in collections API - use ARRAY_STRING
            { key: 'studioTechniques', type: 'ARRAY_STRING', displayName: 'Studio Techniques', required: false },
            { key: 'practiceDescription', type: 'TEXT', displayName: 'Studio Practice Description', required: false, stringLengthRange: { maxLength: 3000 } },
            
            // Community (5)
            { key: 'studioSpaceType', type: 'TEXT', displayName: 'Studio Space Type', required: false },
            { key: 'communityGoalsSupport', type: 'TEXT', displayName: 'How to Support Community Goals', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'communityInterests', type: 'TEXT', displayName: 'Community Interests & Contribution', required: false, stringLengthRange: { maxLength: 2000 } },
            { key: 'howHeardAbout', type: 'TEXT', displayName: 'How Heard About Studio', required: false },
            { key: 'questionsComments', type: 'TEXT', displayName: 'Questions or Comments', required: false, stringLengthRange: { maxLength: 2000 } },
            
            // Meta (6)
            { key: 'submissionId', type: 'TEXT', displayName: 'Fillout Submission ID', required: false },
            { key: 'enrichmentInfo', type: 'TEXT', displayName: 'Enrichment Info', required: false },
            { key: 'status', type: 'TEXT', displayName: 'Application Status', required: false },
            { key: 'submissionDate', type: 'DATETIME', displayName: 'Submission Date', required: false },
            { key: 'approvalDate', type: 'DATETIME', displayName: 'Approval Date', required: false },
            { key: 'wixMemberId', type: 'TEXT', displayName: 'Linked Wix Member ID', required: false },
            { key: 'newsletterOptIn', type: 'BOOLEAN', displayName: 'Newsletter Opt-In', required: false }
        ]
    };
}

export async function replaceCollectionSchema() {
    try {
        console.log(`Starting schema replacement for ${COLLECTION_ID}...`);
        
        const getCollection = elevate(collections.getDataCollection);
        const currentCollection = await getCollection(COLLECTION_ID);
        
        if (!currentCollection) {
            throw new Error(`Collection ${COLLECTION_ID} not found`);
        }
        
        console.log(`Current revision: ${currentCollection.revision}`);
        
        const newSchema = getCompleteSchema();
        
        const updatedCollection = {
            _id: newSchema.collectionId,
            displayName: newSchema.displayName,
            displayField: newSchema.displayField,
            fields: newSchema.fields,
            permissions: newSchema.permissions,
            revision: currentCollection.revision,
            plugins: currentCollection.plugins || []
        };
        
        const updateCollection = elevate(collections.updateDataCollection);
        // @ts-ignore - TypeScript incorrectly validates string literals as enum types
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

export async function verifySchema() {
    try {
        const getCollection = elevate(collections.getDataCollection);
        const collection = await getCollection(COLLECTION_ID);
        
        const expectedFields = getCompleteSchema().fields;
        const actualFields = collection.fields.filter(f => !f.key.startsWith('_'));
        
        const missing = [];
        const incorrect = [];
        
        expectedFields.forEach(expected => {
            const actual = actualFields.find(f => f.key === expected.key);
            
            if (!actual) {
                missing.push(expected.key);
            } else if (actual.type !== expected.type) {
                incorrect.push({
                    key: expected.key,
                    expected: expected.type,
                    actual: actual.type
                });
            }
        });
        
        const expectedKeys = new Set(expectedFields.map(f => f.key));
        const extra = actualFields
            .filter(f => !expectedKeys.has(f.key))
            .map(f => f.key);
        
        return {
            valid: missing.length === 0 && incorrect.length === 0,
            missing,
            incorrect,
            extra,
            totalFields: actualFields.length
        };
        
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}