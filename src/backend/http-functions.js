// src/backend/http-functions.js
// This file defines the HTTP endpoints for the application.
// It imports business logic from webhook-logic.jsw and test runners from testing.jsw.

import { ok, serverError, forbidden, badRequest } from 'wix-http-functions';
import { authentication } from 'wix-members-backend';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// Import the core business logic from .jsw files (without the extension)
// Velo Note: If you see a "Cannot find module" error here, ensure that
// 'webhook-logic.jsw' exists in your 'backend' folder and that the Velo editor
// has been refreshed or synchronized.
// At the top of http-functions.js, add the new function to your import list
import { 
    findOrCreateContact, 
    findOrCreateMember, 
    buildApplicationData,
    updateMemberWithApplication,
    createApplicationRecord // <-- Add this line
} from 'backend/webhook-logic';

// Import the test runners from .jsw files (without the extension)
// Velo Note: Similarly, ensure 'testing.jsw' is in the 'backend' folder.
import { 
    runAllTests,
    testContactCreation,
    testMemberCreation,
    testApplicationDataBuilding,
    testFullWebhookFlow,
    testInvalidApiKey,
    testMissingEmail
} from 'backend/testing';

// Secret keys stored in Wix Secrets Manager
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
const STUDIO_APPLICATIONS_COLLECTION_ID = "Import1";

/**
 * Main webhook handler for Fillout form submissions.
 * @param {import('wix-http-functions').WixHttpFunctionRequest} request
 * @returns {Promise<import('wix-http-functions').WixHttpFunctionResponse>}
 */
export async function post_helloWebhook(request) {
    try {
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        if (receivedApiKey !== storedApiKey) {
            return forbidden({ body: "Invalid API Key" });
        }

        const payload = await request.body.json();
        
        if (!payload.email) {
            return badRequest({ body: "Email is required in the payload" });
        }
        console.log("Processing studio application for email:", payload.email);

        const contactId = await findOrCreateContact(payload);
        const { memberId, memberData } = await findOrCreateMember(contactId, payload.email);
        const applicationData = await buildApplicationData(payload, memberId);

        console.log("New Studio Application record create request...");
        const newApplication = await createApplicationRecord(applicationData);
        console.log("New Studio Application record created with ID:", newApplication._id);

        if (memberData) {
            await updateMemberWithApplication(memberId, memberData, newApplication._id);
        }

        return ok({
            body: {
                status: "success",
                message: "Studio application processed successfully.",
                data: { contactId, memberId, applicationId: newApplication._id }
            }
        });
    } catch (error) {
        console.error("Error in webhook:", error);
        return serverError({
            body: {
                status: "error",
                message: `Webhook processing failed: ${error.message}`
            }
        });
    }
}

// Simple GET endpoint for basic connectivity testing
export function get_hello(request) {
    return ok({
        body: "Hello from Wix Backend!",
        headers: { 'Content-Type': 'text/plain' }
    });
}

// Simple POST endpoint for testing JSON parsing
export async function post_hello(request) {
    try {
        const data = await request.body.json();
        return ok({
            body: `Hello, ${data.name || 'World'}!`,
            headers: { 'Content-Type': 'text/plain' }
        });
    } catch(e) {
        return badRequest({ body: "Invalid JSON in request body" });
    }
}


// === TEST ENDPOINTS ===

/**
 * Main test runner endpoint. Requires admin authentication.
 * @param {import('wix-http-functions').WixHttpFunctionRequest} request
 * @returns {Promise<import('wix-http-functions').WixHttpFunctionResponse>}
 */
export async function get_runTests(request) {
    try {
        // CORRECTED: 'currentMember' is a function that returns a promise.
        // Velo Note: If you see a "does not exist on type" error, your local
        // Velo environment's type definitions may be out of sync.
        const member = await authentication.currentMember();
        if(!member) return forbidden({ body: JSON.stringify({ error: 'Unauthorized. Please log in.' }) });

        const roles = await member.getRoles();
        const isAdmin = roles.some(role => role.name === 'Admin');

        if (!isAdmin) {
            return forbidden({ body: JSON.stringify({ error: 'Unauthorized. Admin access required.' }) });
        }

        const loginEmail = (member.profile && member.profile.loginEmail) ? member.profile.loginEmail : 'Unknown Admin';
        console.log(`[TEST RUNNER] Starting test suite - triggered by ${loginEmail}`);
        const results = await runAllTests();
        return ok({ body: results, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error('[TEST RUNNER] Error:', error);
        return serverError({ body: JSON.stringify({ error: 'Test suite failed', message: error.message }) });
    }
}

/**
 * Run an individual test. Requires admin authentication.
 * @param {import('wix-http-functions').WixHttpFunctionRequest} request
 * @returns {Promise<import('wix-http-functions').WixHttpFunctionResponse>}
 */
export async function get_runTest(request) {
    try {
        // CORRECTED: 'currentMember' is a function.
        const member = await authentication.currentMember();
        if(!member) return forbidden({ body: JSON.stringify({ error: 'Unauthorized. Please log in.' }) });

        const roles = await member.getRoles();
        const isAdmin = roles.some(role => role.name === 'Admin');

        if (!isAdmin) {
             return forbidden({ body: JSON.stringify({ error: 'Unauthorized. Admin access required.' }) });
        }

        const testName = request.query.test;
        if (!testName) {
            return badRequest({ body: JSON.stringify({ error: 'Missing test parameter' }) });
        }

        const testMap = {
            'contactCreation': testContactCreation,
            'memberCreation': testMemberCreation,
            'applicationDataBuilding': testApplicationDataBuilding,
            'fullWebhookFlow': testFullWebhookFlow,
            'invalidApiKey': testInvalidApiKey,
            'missingEmail': testMissingEmail
        };

        const testFunction = testMap[testName];
        if (!testFunction) {
            return badRequest({ body: JSON.stringify({ error: `Unknown test: ${testName}` }) });
        }
        
        console.log(`[TEST RUNNER] Running individual test: ${testName}`);
        const result = await testFunction();
        return ok({ body: result, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error(`[TEST RUNNER] Error running test ${request.query.test}:`, error);
        return serverError({ body: JSON.stringify({ error: 'Test failed', message: error.message }) });
    }
}

/**
 * Test health check endpoint.
 * @param {import('wix-http-functions').WixHttpFunctionRequest} request
 * @returns {import('wix-http-functions').WixHttpFunctionResponse}
 */
export function get_testHealth(request) {
    return ok({
        body: {
            status: 'healthy',
            message: 'Test system is operational',
            timestamp: new Date().toISOString(),
        }
    });
}
