// src/backend/data-access.js
// Data access layer for StudioMembershipApplications

import wixData from 'wix-data';

const APPLICATIONS_COLLECTION = 'StudioMembershipApplications';

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

export async function insertHelloWorld() {
    const timestamp = new Date();
    const testData = {
        firstName: 'Hello',
        lastName: 'World',
        email: `hello_${timestamp.getTime()}@example.com`,
        phoneNumber: '+1234567890',
        website: 'https://hello-world.example.com',
        hasIndependentExperience: true,
        studioTechniques: 'Test Insert',
        status: 'Test',
        submissionDate: timestamp,
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

export async function queryApplications(filters = {}) {
    try {
        let query = wixData.query(APPLICATIONS_COLLECTION);
        
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.email) {
            query = query.eq('email', filters.email);
        }
        if (filters.hasMembers !== undefined) {
            if (filters.hasMembers) {
                query = query.isNotEmpty('wixMemberId');
            } else {
                query = query.isEmpty('wixMemberId');
            }
        }
        if (filters.dateFrom) {
            query = query.ge('submissionDate', filters.dateFrom);
        }
        if (filters.dateTo) {
            query = query.le('submissionDate', filters.dateTo);
        }
        
        if (filters.sortBy) {
            query = filters.sortDescending 
                ? query.descending(filters.sortBy) 
                : query.ascending(filters.sortBy);
        } else {
            query = query.descending('submissionDate');
        }
        
        const limit = filters.limit || 50;
        query = query.limit(limit);
        
        if (filters.skip) {
            query = query.skip(filters.skip);
        }
        
        const results = await query.find({ suppressAuth: true });
        
        return {
            success: true,
            items: results.items,
            totalCount: results.totalCount,
            hasNext: results.hasNext()
        };
        
    } catch (error) {
        console.error('Query applications failed:', error);
        return {
            success: false,
            error: error.message,
            items: [],
            totalCount: 0
        };
    }
}

export async function getApplication(applicationId) {
    try {
        const application = await wixData.get(APPLICATIONS_COLLECTION, applicationId, { suppressAuth: true });
        
        if (!application) {
            return {
                success: false,
                error: 'Application not found'
            };
        }
        
        return {
            success: true,
            application
        };
        
    } catch (error) {
        console.error(`Failed to get application ${applicationId}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}