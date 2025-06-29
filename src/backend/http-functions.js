// src/backend/http-functions.js

import { ok, serverError, forbidden, badRequest } from 'wix-http-functions';
import { currentMember } from 'wix-members-backend';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// Import from .web.js files (not .jsw)
import { findOrCreateContact } from 'backend/contact-logic.web';
import { findOrCreateMember, ensureMemberProfile } from 'backend/member-logic.web';
import { 
    testCollectionAccess,
    insertHelloWorld,
    getRecentTestEntries,
    createApplication,
    buildApplicationData
} from 'backend/data-access';

const CODE_VERSION = "v.8f2a53e"; // Version tracking
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";

/**
 * Main webhook handler for Fillout form submissions.
 * Processes studio membership applications through the full workflow.
 */
export async function post_studioApplication(request) {
    console.log(`⚡ Executing /studioApplication | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
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
        
        console.log(`📦 Received payload for: ${payload.email}`);

        // Step 1: Create/find contact
        console.log('📋 Step 1: Creating/finding contact...');
        const contactResult = await findOrCreateContact(
            payload.email,
            payload.firstName || '',
            payload.lastName || ''
        );
        
        if (!contactResult || !contactResult.contact) {
            throw new Error('Failed to create or find contact');
        }
        
        console.log(`✅ Contact ready: ${contactResult.contact._id} (new: ${contactResult.wasCreated})`);

        // Step 2: Create/find member
        console.log('👤 Step 2: Creating/finding member...');
        const memberResult = await findOrCreateMember(contactResult.contact);
        
        if (!memberResult || !memberResult.member) {
            throw new Error('Failed to create or find member');
        }
        
        console.log(`✅ Member ready: ${memberResult.member._id} (new: ${memberResult.wasCreated})`);

        // Step 3: Ensure member has a profile in PrivateMembersData
        console.log('📄 Step 3: Ensuring member profile...');
        const profileResult = await ensureMemberProfile(memberResult.member);
        
        if (!profileResult.success) {
            console.warn('Failed to ensure member profile:', profileResult.error);
            // Non-critical, continue processing
        } else {
            console.log(`✅ Member profile ready (created: ${profileResult.created})`);
        }

        // Step 4: Build and create application
        console.log('📝 Step 4: Creating application record...');
        const applicationData = buildApplicationData(payload, memberResult.member._id);
        const applicationResult = await createApplication(applicationData);
        
        if (!applicationResult.success) {
            throw new Error(`Failed to create application: ${applicationResult.error}`);
        }
        
        console.log(`✅ Application created: ${applicationResult.applicationId}`);

        // Success response
        return ok({
            body: {
                status: "success",
                message: "Studio application processed successfully",
                version: CODE_VERSION,
                data: {
                    contactId: contactResult.contact._id,
                    contactIsNew: contactResult.wasCreated,
                    memberId: memberResult.member._id,
                    memberIsNew: memberResult.wasCreated,
                    applicationId: applicationResult.applicationId
                }
            }
        });
        
    } catch (error) {
        console.error(`❌ StudioApplication error: ${error.message}`);
        console.error('Full error:', error);
        
        return serverError({
            body: {
                error: "Failed to process application",
                message: error.message,
                version: CODE_VERSION
            }
        });
    }
}

// === SIMPLE TEST ENDPOINTS ===

/**
 * Basic connectivity test endpoint
 */
export function get_ping(request) {
    console.log(`⚡ Executing /ping | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    return ok({
        body: {
            status: "alive",
            timestamp: new Date().toISOString(),
            version: CODE_VERSION
        }
    });
}

/**
 * Test collection access
 */
export async function get_testAccess(request) {
    console.log(`⚡ Executing /testAccess | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        const result = await testCollectionAccess();
        console.log(`✅ Collection access test: ${result.message}`);
        
        return ok({
            body: {
                status: "success",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                collectionTest: result
            }
        });
    } catch (error) {
        console.error('Collection access error:', error);
        return serverError({
            body: {
                error: "Collection access failed",
                message: error.message
            }
        });
    }
}

/**
 * Test insert hello world
 */
export async function post_helloInsert(request) {
    console.log(`⚡ Executing /helloInsert | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
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
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Insert error:', error);
        return serverError({
            body: {
                error: "Insert failed",
                message: error.message
            }
        });
    }
}

/**
 * View recent test entries
 */
export async function get_recentTests(request) {
    console.log(`⚡ Executing /recentTests | 📍 Version: ${CODE_VERSION} | 🕐 ${new Date().toISOString()}`);
    
    try {
        const result = await getRecentTestEntries();
        console.log(`✅ Found ${result.count} recent test entries`);
        
        return ok({
            body: {
                status: "success",
                timestamp: new Date().toISOString(),
                version: CODE_VERSION,
                testEntries: result
            }
        });
    } catch (error) {
        console.error('Query error:', error);
        return serverError({
            body: {
                error: "Query failed",
                message: error.message
            }
        });
    }
}

// === LEGACY ENDPOINTS (kept for compatibility) ===

export function get_hello(request) {
    return ok({
        body: "Hello from Wix Backend!",
        headers: { 'Content-Type': 'text/plain' }
    });
}

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