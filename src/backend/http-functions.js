// src/backend/http-functions.js
// Add imports for new functionality
import { ok, badRequest, forbidden, serverError } from 'wix-http-functions';
import { isValidApiKey } from './auth-utils.web';
import { createApplication, testCollectionAccess, insertHelloWorld, getRecentTestEntries } from './data-access';
import { findOrCreateContact } from './contact-logic.web';
import { requireAdmin, generateSystemReport } from './admin-tools';

// NEW IMPORTS
import { getFieldMapping, parseBoolean } from './collection-schema-updater';
import { replaceCollectionSchema, verifySchema } from './schema-complete-replacement';


// DO NOT EDIT OR REMOVE. Version tracking for debugging
const VERSION = "v.4b70641";

function createResponse(data, status = 200) {
    return {
        status,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data, null, 2)
    };
}

// NEW: Transform Fillout form data
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

// UPDATED: Main webhook with transform
export async function post_studioApplication(request) {
    try {
        console.log('===== STUDIO APPLICATION WEBHOOK CALLED =====');
        
        const isValid = await isValidApiKey(request);
        if (!isValid) {
            console.error('Invalid API key provided');
            return forbidden(createResponse({
                status: 'error',
                error: 'INVALID_API_KEY',
                message: 'Invalid or missing API key'
            }));
        }
        
        const rawPayload = await request.body.json();
        console.log('Raw payload received:', JSON.stringify(rawPayload, null, 2));
        
        // NEW: Transform the data
        const applicationData = transformFormData(rawPayload);
        console.log('Transformed data:', JSON.stringify(applicationData, null, 2));
        
        if (!applicationData.email) {
            return badRequest(createResponse({
                status: 'error',
                error: 'MISSING_EMAIL',
                message: 'Email is required'
            }));
        }
        
        console.log('[WEBHOOK] Creating/finding contact...');
        const contactResult = await findOrCreateContact(
            applicationData.email,
            applicationData.firstName,
            applicationData.lastName
        );
        
        console.log('[WEBHOOK] Creating application...');
        const appResult = await createApplication(applicationData);
        
        if (!appResult.success) {
            throw new Error(appResult.error || 'Failed to create application');
        }
        
        const response = {
            status: 'success',
            message: 'Application received successfully',
            data: {
                applicationId: appResult.applicationId,
                contactId: contactResult.contact._id,
                contactIsNew: contactResult.wasCreated
            }
        };
        
        console.log('✅ Webhook completed successfully');
        return ok(createResponse(response));
        
    } catch (error) {
        console.error('❌ Webhook error:', error);
        return serverError(createResponse({
            status: 'error',
            error: 'WEBHOOK_ERROR',
            message: error.message || 'An unexpected error occurred',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }));
    }
}

// NEW: Schema management endpoints
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

// EXISTING ENDPOINTS (unchanged)
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

export async function get_ping(request) {
    console.log('Ping endpoint called');
    return ok(createResponse({
        status: 'alive',
        timestamp: new Date().toISOString(),
        message: 'Wix HTTP functions are working!'
    }));
}

export async function get_testAccess(request) {
    console.log('Test access endpoint called');
    const collectionTest = await testCollectionAccess();
    
    return ok(createResponse({
        status: 'success',
        collectionTest
    }));
}

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

export async function get_recentTests(request) {
    console.log('Recent tests endpoint called');
    const testEntries = await getRecentTestEntries(10);
    
    return ok(createResponse({
        status: 'success',
        testEntries
    }));
}