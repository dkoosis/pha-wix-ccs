// src/backend/data-access.jsw
// Data access layer - separated from HTTP concerns

import wixData from 'wix-data';
import { elevate } from 'wix-auth';

/**
 * Test query functionality on a collection
 */
export async function testCollectionAccess(collectionId) {
    try {
        // Fix: elevate the entire query chain
        const query = wixData.query(collectionId).limit(5);
        const results = await elevate(query.find)();
        
        return {
            success: true,
            count: results.items.length,
            hasMore: results.hasNext()
        };
    } catch (error) {
        console.error(`Data access error for ${collectionId}:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Insert a record into a collection
 */
export async function insertRecord(collectionId, data) {
    try {
        const result = await elevate(wixData.insert)(collectionId, data);
        return {
            success: true,
            item: result
        };
    } catch (error) {
        console.error(`Insert error for ${collectionId}:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
}