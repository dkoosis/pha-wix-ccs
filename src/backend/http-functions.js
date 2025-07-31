// src/backend/http-functions.js
import { ok, badRequest, serverError, forbidden } from 'wix-http-functions';
import { createApplication, testCollectionAccess, insertHelloWorld, getRecentTestEntries } from './data-access';
import { findOrCreateContact } from './contact-logic.web';
import { isValidApiKey } from './auth-utils.web';
import { requireAdmin, generateSystemReport } from './admin-tools.js';
import { replaceCollectionSchema, verifySchema } from './schema-complete-replacement.js';

// DO NOT EDIT OR REMOVE. Version tracking for debugging
const VERSION = "v.9de7354";

// ===================================================================
// =========================  WEB HOOKS  =============================
// ===================================================================

/**
 * Primary webhook for receiving new studio membership applications.
 * @param {import('wix-http-functions').WixHttpFunctionRequest} request
 * @returns {Promise<import('wix-http-functions').WixHttpFunctionResponse>}
 */
export async function post_studioApplication(request) {
    // Log the version to confirm which deployment is running
    console.log(`🚀 API call to studioApplication. Version: ${VERSION}`);

    // 1. Authenticate the request
    const isAuthorized = await isValidApiKey(request);
    if (!isAuthorized) {
        return badRequest({
            body: JSON.stringify({
                status: 'error',
                error: 'Invalid API Key'
            })
        });
    }

    try {
        // 2. Get the request body directly (no transformation needed)
        const body = await request.body.json();

        // 3. Find or create a CRM contact (currently stubbed)
        const contactResult = await findOrCreateContact(
            body.email,
            body.firstName,
            body.lastName
        );

        // 4. Prepare the application object for the database
        const application = {
            ...body,
            status: body.status || 'Submitted',
            submissionDate: body.submissionDate || new Date(),
            title: body.title || `${body.firstName} ${body.lastName} - ${new Date().toISOString().split('T')[0]}`
        };

        // Fix website URL if missing protocol
        if (application.website && !application.website.match(/^https?:\/\//)) {
            application.website = 'https://' + application.website;
        }

        // Ensure studioTechniques is joined for tags field
        if (Array.isArray(application.studioTechniques)) {
            application.studioTechniques = application.studioTechniques.join(', ');
        }

        // TODO: Add disability accommodation question to form (ADA compliance)
        // TODO: Fillout enrichment data needs concatenation - check if on Fillout side or here
        // TODO: Currently no contact info captured for rejected applicants - fix workflow
        // TODO: Verify auto email ACK - from Fillout or implement in Wix?

        // 5. Save the application record to the database
        const result = await createApplication(application);

        // 6. Build the success response payload
        const responsePayload = {
            status: 'success',
            data: {
                contactId: contactResult.contact._id,
                contactIsNew: contactResult.wasCreated,
                memberId: 'N/A', // Member creation happens during approval phase
                memberIsNew: false,
                applicationId: result.applicationId,
                version: VERSION
            }
        };

        return ok({
            body: JSON.stringify(responsePayload)
        });

    } catch (error) {
        console.error('Error in studioApplication webhook:', error);
        return serverError({
            body: JSON.stringify({
                status: 'error',
                message: 'An unexpected error occurred.',
                error: error.message
            })
        });
    }
}

/**
 * Creates a standardized HTTP response object
 */
function createResponse(data, status = 200) {
    return {
        status,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data, null, 2)
    };
}

/**
 * Replaces the current collection schema with new version
 */
export async function post_replaceSchema(request) {
    try {
        console.log('===== REPLACE SCHEMA ENDPOINT CALLED =====');
        
        const admin = await requireAdmin();
        console.log(`Admin ${admin.loginEmail} is replacing schema`);
        
        const result = await replaceCollectionSchema();
        
        if (result.success) {
            const verification = await verifySchema();
            
            return ok(createResponse({
                status: 'success',
                message: 'Schema replaced successfully',
                replacement: result,
                verification: verification
            }));
        } else {
            return serverError(createResponse({
                status: 'error',
                error: 'REPLACEMENT_FAILED',
                message: result.error,
                details: result.details
            }));
        }
        
    } catch (error) {
        console.error('Schema replacement error:', error);
        
        if (error.message?.includes('Unauthorized')) {
            return forbidden(createResponse({
                status: 'error',
                error: 'UNAUTHORIZED',
                message: error.message
            }));
        }
        
        return serverError(createResponse({
            status: 'error',
            error: 'REPLACEMENT_ERROR',
            message: error.message || 'Failed to replace schema'
        }));
    }
}

/**
 * Verifies the current collection schema is valid
 */
export async function get_verifySchema(request) {
    try {
        console.log('===== VERIFY SCHEMA ENDPOINT CALLED =====');
        
        const verification = await verifySchema();
        
        return ok(createResponse({
            status: 'success',
            schemaValid: verification.valid,
            verification: verification
        }));
        
    } catch (error) {
        console.error('Schema verification error:', error);
        
        return serverError(createResponse({
            status: 'error',
            error: 'VERIFICATION_ERROR',
            message: error.message
        }));
    }
}

/**
 * Generates administrative system report
 */
export async function get_adminReport(request) {
    try {
        await requireAdmin();
        const report = await generateSystemReport();
        
        return ok(createResponse({
            status: 'success',
            report
        }));
        
    } catch (error) {
        console.error('Admin report error:', error);
        
        if (error.message?.includes('Unauthorized')) {
            return forbidden(createResponse({
                status: 'error',
                error: 'UNAUTHORIZED',
                message: error.message
            }));
        }
        
        return serverError(createResponse({
            status: 'error',
            error: 'REPORT_ERROR',
            message: error.message
        }));
    }
}

/**
 * Health check endpoint to verify service availability
 */
export async function get_ping(request) {
    console.log('Ping endpoint called');
    return ok(createResponse({
        status: 'alive',
        timestamp: new Date().toISOString(),
        message: 'Wix HTTP functions are working!'
    }));
}

/**
 * Tests database collection access permissions
 */
export async function get_testAccess(request) {
    console.log('Test access endpoint called');
    const collectionTest = await testCollectionAccess();
    
    return ok(createResponse({
        status: 'success',
        collectionTest
    }));
}

/**
 * Creates a test record in the database
 */
export async function post_helloInsert(request) {
    console.log('Hello insert endpoint called');
    const insertResult = await insertHelloWorld();
    
    if (insertResult.success) {
        return ok(createResponse({
            status: 'success',
            insertResult: {
                id: insertResult.id,
                email: insertResult.data.email
            }
        }));
    } else {
        return serverError(createResponse({
            status: 'error',
            error: insertResult.error,
            code: insertResult.code
        }));
    }
}

/**
 * Retrieves recent test entries from the database
 */
export async function get_recentTests(request) {
    console.log('Recent tests endpoint called');
    const testEntries = await getRecentTestEntries(10);
    
    return ok(createResponse({
        status: 'success',
        testEntries
    }));
}