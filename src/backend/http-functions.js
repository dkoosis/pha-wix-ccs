// src/backend/http-functions.js
// Simplified version with API key authentication
// v1154A

import { ok, serverError, forbidden, badRequest } from 'wix-http-functions';
import { currentMember } from 'wix-members-backend';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// Import business logic
import { 
    findOrCreateContact, 
    findOrCreateMember, 
    buildApplicationData,
    updateMemberWithApplication,
    createApplicationRecord
} from 'backend/webhook-logic.jsw';

// Import test runners
import { 
    runAllTests,
    testContactCreation,
    testMemberCreation,
    testApplicationDataBuilding,
    testFullWebhookFlow,
    testInvalidApiKey,
    testMissingEmail
} from 'backend/testing.jsw';

// ... imports
const CODE_VERSION = "git:2a1f791"; // The script will replace this line
// Secret keys stored in Wix Secrets Manager
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
const STUDIO_APPLICATIONS_COLLECTION_ID = "Import1";

/**
 * Main webhook handler for Fillout form submissions.
 */
export async function post_helloWebhook(request) {
   console.log(`Executing Webhook - Code Version: ${CODE_VERSION}`);
    try {
        // Verify API key
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        if (receivedApiKey !== storedApiKey) {
            return forbidden({ body: "Invalid API Key" });
        }

        // Parse and validate payload
        const payload = await request.body.json();
        
        if (!payload.email) {
            return badRequest({ body: "Email is required in the payload" });
        }
        
        console.log("Processing studio application for email:", payload.email);

        // Step 1: Create/find contact
        const contactId = await findOrCreateContact(payload);
        
        // Step 2: Create/find member
        const { memberId, memberData } = await findOrCreateMember(contactId, payload.email);
        
        // Step 3: Build application data
        const applicationData = buildApplicationData(payload, memberId);

        // Step 4: Create application
        console.log("Creating Studio Application record...");
        const newApplication = await createApplicationRecord(applicationData);
        console.log("Studio Application created with ID:", newApplication._id);

        // Step 5: Link application to member (non-critical)
        if (memberData) {
            await updateMemberWithApplication(memberId, memberData, newApplication._id);
        }

        return ok({
            body: {
                status: "success",
                message: "Studio application processed successfully.",
                data: { 
                    contactId, 
                    memberId, 
                    applicationId: newApplication._id 
                }
            }
        });
        
    } catch (error) {
        console.error("Error in webhook:", error);
        console.error("Error type:", typeof error);
        console.error("Error stack:", error?.stack);
        
        // Simple error message handling
        let errorMessage = "Webhook processing failed: ";
        if (error && error.message) {
            if (error.message.includes('MEMBER_EMAIL_EXISTS')) {
                errorMessage += "Member registration conflict. Please try again.";
            } else if (error.message.includes('permission')) {
                errorMessage += "Database permission error. Please check collection settings.";
            } else {
                errorMessage += error.message;
            }
        } else if (error && typeof error === 'string') {
            errorMessage += error;
        } else {
            errorMessage += "Unknown error occurred.";
        }
        
        return serverError({
            body: {
                status: "error",
                message: errorMessage
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
 */
export async function get_runTests(request) {
    try {
        const member = await currentMember();
        if(!member) return forbidden({ body: JSON.stringify({ error: 'Unauthorized. Please log in.' }) });

        const roles = await member.getRoles();
        const isAdmin = roles.some(role => role.name === 'Admin');

        if (!isAdmin) {
            return forbidden({ body: JSON.stringify({ error: 'Unauthorized. Admin access required.' }) });
        }

        const loginEmail = member.loginEmail || 'Unknown Admin';
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
 */
export async function get_runTest(request) {
    try {
        const member = await currentMember();
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