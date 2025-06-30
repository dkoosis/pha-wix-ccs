// src/backend/data-access.js
// Simple data access layer for StudioMembershipApplications

import wixData from 'wix-data';

const APPLICATIONS_COLLECTION = 'StudioMembershipApplications';

/**
 * Test if we can access the collection
 */
export async function testCollectionAccess(collectionName = APPLICATIONS_COLLECTION) {
    try {
        const results = await wixData.query(collectionName)
            .limit(1)
            .find({ suppressAuth: true });
            
        return {
            success: true,
            count: results.totalCount,
            message: `Collection accessible. Total items: ${results.totalCount}`
        };
    } catch (error) {
        console.error(`Cannot access collection "${collectionName}":`, error);
        return {
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN'
        };
    }
}

/**
 * Simple hello world insert into StudioMembershipApplications
 */
export async function insertHelloWorld() {
    const timestamp = new Date();
    const testData = {
        // Basic required fields based on your CSV structure
        firstName: 'Hello',
        lastName: 'World',
        email: `hello_${timestamp.getTime()}@example.com`,
        phoneNumber: '+1234567890',
        website: 'https://hello-world.example.com',
        hasIndependentExperience: true,
        studioTechniques: 'Test Insert',
        
        // Add a title for easy identification
        title: `Hello World Test - ${timestamp.toISOString()}`
    };
    
    console.log('Attempting to insert:', JSON.stringify(testData, null, 2));
    
    try {
        const result = await wixData.insert(APPLICATIONS_COLLECTION, testData, { suppressAuth: true });
        console.log('Insert successful:', result._id);
        
        return {
            success: true,
            id: result._id,
            data: result
        };
    } catch (error) {
        console.error('Insert failed:', error);
        return {
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN'
        };
    }
}

/**
 * Get recent test entries
 */
export async function getRecentTestEntries(limit = 5) {
    try {
        const results = await wixData.query(APPLICATIONS_COLLECTION)
            .startsWith('email', 'hello_')
            .descending('_createdDate')
            .limit(limit)
            .find({ suppressAuth: true });
            
        return {
            success: true,
            count: results.items.length,
            items: results.items
        };
    } catch (error) {
        console.error('Query failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Create a full application record
 * NOTE: No longer links to member - that happens during approval
 */
export async function createApplication(applicationData) {
    if (!applicationData || !applicationData.email) {
        throw new Error("Application data with email is required");
    }

    console.log('[APP] Creating application with data:', JSON.stringify(applicationData, null, 2));

    try {
        const result = await wixData.insert(APPLICATIONS_COLLECTION, applicationData, { suppressAuth: true });
        console.log(`[APP] Application created with ID: ${result._id}`);
        
        return {
            success: true,
            applicationId: result._id,
            application: result
        };
    } catch (error) {
        console.error('[APP] Failed to create application:', error);
        return {
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN'
        };
    }
}

/**
 * Build application data from form payload
 * NOTE: No longer includes member ID - members are created during approval, not submission
 */
export function buildApplicationData(payload) {
    const applicationData = {
        // TODO: Change 'applicantProfile' to 'wixMemberId' when schema is updated
        // Member linking now happens during approval in the data hook
        
        // Basic info
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        email: payload.email || '',
        phoneNumber: payload.phone || payload.phoneNumber || '',
        website: payload.website || '',
        
        // Experience fields
        hasIndependentExperience: payload.hasExperience || false,
        studioTechniques: Array.isArray(payload.hasTechniques) 
            ? payload.hasTechniques.join(', ') 
            : (payload.hasTechniques || payload.studioTechniques || ''),
        
        // TODO: Add all additional fields from the actual membership application form:
        // - experienceDescription
        // - practiceDescription
        // - safetyDescription
        // - knowsSafety
        // - etc.
        
        // Title for easy identification
        title: `${payload.firstName} ${payload.lastName} - ${new Date().toISOString().split('T')[0]}`
    };

    // Clean undefined/null fields
    Object.keys(applicationData).forEach(key => {
        if (applicationData[key] === undefined || applicationData[key] === null) {
            delete applicationData[key];
        }
    });
    
    return applicationData;
}

// REMOVED: linkApplicationToMember function
// Application-to-member linking now happens in the data hook during approval
// using wixData.update() with the member ID