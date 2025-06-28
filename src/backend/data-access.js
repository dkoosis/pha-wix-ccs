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