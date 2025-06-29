// src/backend/auth-utils.web.js
// Simple API key check

import { getSecret } from 'wix-secrets-backend';

/**
 * Check if the API key is valid
 */
export async function isValidApiKey(request) {
    try {
        const receivedKey = request.headers['x-api-key'];
        const storedKey = await getSecret('FILLOUT_X_API_KEY');
        return receivedKey === storedKey;
    } catch (error) {
        console.error('API key check failed:', error);
        return false;
    }
}