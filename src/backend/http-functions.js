// src/backend/http-functions.js
// Minimal version with API key - Step 1

import { ok, serverError, forbidden } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';

const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
const CODE_VERSION = "v.fa1e9e6"; // The script will replace this line

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