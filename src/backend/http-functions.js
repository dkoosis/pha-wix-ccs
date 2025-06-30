// src/backend/http-functions.js
import {
    ok,
    badRequest,
    serverError,
    forbidden
} from 'wix-http-functions';
import {
    createApplication
} from './data-access';
import {
    findOrCreateContact
} from './contact-logic.web';
import {
    transformFilloutPayload
} from './collection-schema-updater';
import {
    isValidApiKey
} from './auth-utils.web';
import {
    requireAdmin,
    generateSystemReport
} from './admin-tools.js';
import {
    replaceCollectionSchema,
    verifySchema
} from './schema-complete-replacement.js';

// import { 
//     testCollectionAccess,
//     insertHelloWorld,
//     getRecentTestEntries 
// } from './test-functions';

// DO NOT EDIT OR REMOVE. Version tracking for debugging
const VERSION = "v.3559f03";

/**
 * Returns mapping between form field names and database field names
 */
function getFieldMapping() {
    return {
        'formFieldName': 'dbFieldName',
        'firstName': 'firstName',
        'lastName': 'lastName',
        'hasIndependentExperience': 'hasIndependentExperience',
        'knowsSafety': 'knowsSafety',
        'newsletterOptIn': 'newsletterOptIn',
        'studioTechniques': 'studioTechniques'
    };
}

/**
 * Converts various input types to boolean value
 */
function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
    }
    return false;
}

/**
 * Tests if collection access is available
 */
async function testCollectionAccess() {
    return { 
        accessible: true, 
        message: 'Collection access test not implemented' 
    };
}

/**
 * Inserts a test record into the database
 */
async function insertHelloWorld() {
    return {
        success: false,
        error: 'insertHelloWorld not implemented',
        code: 'NOT_IMPLEMENTED'
    };
}

/**
 * Retrieves recent test entries from the database
 */
async function getRecentTestEntries(limit) {
    return [];
}

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
    const apiKey = request.headers['x-api-key'];
    if (!isValidApiKey(apiKey)) {
        // Corrected the response structure for badRequest
        return badRequest({
            body: JSON.stringify({
                status: 'error',
                error: 'Invalid API Key'
            })
        });
    }

    try {
        // 2. Get the request body and transform the payload
        const body = await request.body.json();
        const payloadV2 = transformFilloutPayloadToV2(body);

        // 3. Find or create a CRM contact
        const {
            contactId,
            isNew: contactIsNew
        } = await findOrCreateContact(payloadV2);

        // NOTE: Member creation is stubbed for now.
        const {
            memberId,
            isNew: memberIsNew
        } = {
            memberId: 'N/A',
            isNew: false
        };

        // 4. Prepare the application object for the database
        const application = {
            ...payloadV2,
            'wix-contact-id': contactId,
        };

        // 5. Save the application record to the database
        const result = await createApplication(application);

        // 6. Build the success response payload
        const responsePayload = {
            status: 'success',
            data: {
                contactId,
                contactIsNew,
                memberId,
                memberIsNew,
                applicationId: result._id,
                version: VERSION
            }
        };

        return ok({
            body: responsePayload
        });

    } catch (error) {
        console.error('Error in studioApplication webhook:', error);
        return serverError({
            body: {
                status: 'error',
                message: 'An unexpected error occurred.',
                error: error.message
            }
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
 * Transforms Fillout form data to database schema format
 */
function transformFormData(payload) {
    const fieldMapping = getFieldMapping();
    const transformed = {};
    
    // Map fields
    for (const [formField, dbField] of Object.entries(fieldMapping)) {
        if (payload[formField] !== undefined) {
            transformed[dbField] = payload[formField];
        }
    }
    
    // Convert booleans
    if (transformed.hasIndependentExperience !== undefined) {
        transformed.hasIndependentExperience = parseBoolean(transformed.hasIndependentExperience);
    }
    if (transformed.knowsSafety !== undefined) {
        transformed.knowsSafety = parseBoolean(transformed.knowsSafety);
    }
    if (transformed.newsletterOptIn !== undefined) {
        transformed.newsletterOptIn = parseBoolean(transformed.newsletterOptIn);
    }
    
    // Handle arrays
    if (Array.isArray(transformed.studioTechniques)) {
        transformed.studioTechniques = transformed.studioTechniques.join(', ');
    }
    
    // Add metadata
    transformed.status = 'Submitted';
    transformed.submissionDate = new Date();
    
    // Create title
    if (transformed.firstName && transformed.lastName) {
        transformed.title = `${transformed.firstName} ${transformed.lastName} - ${new Date().toISOString().split('T')[0]}`;
    }
    
    return transformed;
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