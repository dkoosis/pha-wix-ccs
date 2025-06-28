// src/backend/data-access.js

import wixData from 'wix-data';

/**
 * A reusable function to test or perform a basic query on any Wix Data collection.
 * This is intended for use by other backend modules.
 * @param {string} collectionName The ID of the Wix Data collection to query.
 * @returns {Promise<object>} An object indicating success and the number of items found.
 * @throws {Error} Throws an error if the collection cannot be accessed.
 */
export async function testCollectionAccess(collectionName) {
    if (!collectionName) {
        throw new Error("Collection name is required for testCollectionAccess.");
    }
    try {
        const results = await wixData.query(collectionName).limit(1).find();
        return {
            success: true,
            count: results.totalCount
        };
    } catch (error) {
        console.error(`Data access error for collection "${collectionName}":`, error);
        throw new Error(`Failed to query collection: '${collectionName}'.`);
    }
}

/**
 * A second function from your data-access module.
 * (Assuming its purpose - please adjust if this is incorrect)
 * @param {string} someParameter A parameter needed for this function's logic.
 * @returns {Promise<any>} The result of the function's operation.
 */
export async function anotherDataAccessFunction(someParameter) {
    // Add the logic for your second function here.
    // For example:
    if (!someParameter) {
        throw new Error("A parameter is required for anotherDataAccessFunction.");
    }
    try {
        // Example: another query or some other backend logic
        const anotherResult = await wixData.query("AnotherCollection")
            .eq("title", someParameter)
            .find();
            
        return anotherResult.items;

    } catch (error) {
        console.error(`Error in anotherDataAccessFunction with param "${someParameter}":`, error);
        throw new Error(`Operation failed in anotherDataAccessFunction.`);
    }
}