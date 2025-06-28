// src/backend/http-functions.js
// Minimal version with API key - Step 1

import { ok, serverError, forbidden } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import { testCollectionAccess } from 'backend/data-access';

const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
const CODE_VERSION = "v.8bf5fd6"; // The script will replace this line

// Test endpoint - with API key validation
export async function get_ping(request) {
    console.log(`⚡ Executing /ping | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        
        if (receivedApiKey !== storedApiKey) {
            console.log(`❌ Ping failed: Invalid API key | 🔑 Received: ${receivedApiKey?.substring(0, 8)}...`);
            return forbidden({ 
                body: {
                    error: "Invalid API Key"
                }
            });
        }
        
        console.log(`✅ Ping authenticated | 🔑 Valid API key`);
        
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
                message: error.message
            }
        });
    }
}

// POST endpoint - accepts form data with minimal validation
export async function post_echo(request) {
    console.log(`⚡ Executing /echo | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        
        if (receivedApiKey !== storedApiKey) {
            console.log(`❌ Echo failed: Invalid API key`);
            return forbidden({ 
                body: {
                    error: "Invalid API Key"
                }
            });
        }
        
        // Parse JSON payload
        const payload = await request.body.json();
        console.log(`✅ Echo received | 📧 Email: ${payload.email} | 🔑 ID: ${payload.applicationID}`);
        
        return ok({
            body: {
                status: "success",
                message: "Payload received",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                received: {
                    email: payload.email,
                    applicationID: payload.applicationID
                }
            }
        });
    } catch (error) {
        console.error(`❌ Echo error: ${error.message}`);
        return serverError({
            body: {
                error: "Echo processing failed",
                message: error.message
            }
        });
    }
}

// Update the testData function logging
export async function get_testData(request) {
    console.log(`⚡ Executing /testData | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        
        if (receivedApiKey !== storedApiKey) {
            console.log(`❌ TestData failed: Invalid API key`);
            return forbidden({ 
                body: {
                    error: "Invalid API Key"
                }
            });
        }
        
        // Test collection access using the separated module
        const testResult = await testCollectionAccess("Import1");
        
        // Fix: Use appropriate icon based on actual success
        if (testResult.success) {
            console.log(`✅ Data test passed | 📊 Found ${testResult.count} items`);
        } else {
            console.log(`❌ Data test failed | Error: ${testResult.error}`);
        }
        
        return ok({
            body: {
                status: "success",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                tests: {
                    query: testResult
                }
            }
        });
    } catch (error) {
        console.error(`❌ TestData error: ${error.message}`);
        return serverError({
            body: {
                error: "Data test failed",
                message: error.message
            }
        });
    }
}