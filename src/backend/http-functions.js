// src/backend/http-functions.js
// Minimal version - Step by step testing

import { ok, serverError, forbidden } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { testCollectionAccess, insertHelloWorld, getRecentTestEntries } from 'backend/data-access.js';

const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
const CODE_VERSION = "v.f2ec709";

// === STEP 1: Basic connectivity ===
export async function get_ping(request) {
    console.log(`⚡ Executing /ping | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        
        if (receivedApiKey !== storedApiKey) {
            console.log(`❌ Ping failed: Invalid API key`);
            return forbidden({ 
                body: {
                    error: "Invalid API Key",
                    version: CODE_VERSION
                }
            });
        }
        
        console.log(`✅ Ping authenticated`);
        
        return ok({
            body: {
                status: "alive",
                timestamp: new Date().toISOString(),
                authenticated: true,
                version: CODE_VERSION
            }
        });
    } catch (error) {
        console.error(`❌ Ping error: ${error.message}`);
        return serverError({
            body: {
                error: "Failed to validate API key",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}

// === STEP 2: Test collection access ===
export async function get_testAccess(request) {
    console.log(`⚡ Executing /testAccess | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        
        if (receivedApiKey !== storedApiKey) {
            console.log(`❌ TestAccess failed: Invalid API key`);
            return forbidden({ 
                body: {
                    error: "Invalid API Key",
                    version: CODE_VERSION
                }
            });
        }
        
        // Test collection access
        const result = await testCollectionAccess();
        
        console.log(`${result.success ? '✅' : '❌'} Collection access test: ${result.message || result.error}`);
        
        return ok({
            body: {
                status: result.success ? "success" : "failed",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                collectionTest: result
            }
        });
    } catch (error) {
        console.error(`❌ TestAccess error: ${error.message}`);
        return serverError({
            body: {
                error: "Test failed",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}

// === STEP 3: Hello World Insert ===
export async function post_helloInsert(request) {
    console.log(`⚡ Executing /helloInsert | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        
        if (receivedApiKey !== storedApiKey) {
            console.log(`❌ HelloInsert failed: Invalid API key`);
            return forbidden({ 
                body: {
                    error: "Invalid API Key",
                    version: CODE_VERSION
                }
            });
        }
        
        // Do the insert
        console.log('📝 Attempting hello world insert...');
        const result = await insertHelloWorld();
        
        if (result.success) {
            console.log(`✅ Insert successful! ID: ${result.id}`);
            return ok({
                body: {
                    status: "success",
                    message: "Hello World inserted successfully",
                    timestamp: new Date().toISOString(),
                    version: CODE_VERSION,
                    insertResult: {
                        id: result.id,
                        email: result.data.email
                    }
                }
            });
        } else {
            console.log(`❌ Insert failed: ${result.error}`);
            return serverError({
                body: {
                    status: "error",
                    message: "Insert failed",
                    error: result.error,
                    code: result.code,
                    version: CODE_VERSION
                }
            });
        }
    } catch (error) {
        console.error(`❌ HelloInsert error: ${error.message}`);
        return serverError({
            body: {
                error: "Insert operation failed",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}

// === STEP 4: View recent test entries ===
export async function get_recentTests(request) {
    console.log(`⚡ Executing /recentTests | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        
        if (receivedApiKey !== storedApiKey) {
            console.log(`❌ RecentTests failed: Invalid API key`);
            return forbidden({ 
                body: {
                    error: "Invalid API Key",
                    version: CODE_VERSION
                }
            });
        }
        
        // Get recent entries
        const result = await getRecentTestEntries();
        
        console.log(`${result.success ? '✅' : '❌'} Found ${result.count || 0} recent test entries`);
        
        return ok({
            body: {
                status: result.success ? "success" : "failed",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                testEntries: result
            }
        });
    } catch (error) {
        console.error(`❌ RecentTests error: ${error.message}`);
        return serverError({
            body: {
                error: "Query failed",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}