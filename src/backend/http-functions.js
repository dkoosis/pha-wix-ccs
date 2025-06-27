// src/backend/http-functions.js
// Updated version with exportable functions for testing

import { contacts } from 'wix-crm-backend';
import { authentication } from 'wix-members-backend';
import { ok, serverError, forbidden, badRequest } from 'wix-http-functions';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import { 
    runAllTests,
    testContactCreation,
    testMemberCreation,
    testApplicationDataBuilding,
    testFullWebhookFlow,
    testInvalidApiKey,
    testMissingEmail
} from 'backend/testing.jsw';


// Secret keys stored in Wix Secrets Manager
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
// Collection IDs
const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
const STUDIO_APPLICATIONS_COLLECTION_ID = "Import1";

/**
 * Main webhook handler for Fillout form submissions.
 * 
 * This endpoint receives ceramics studio membership applications from Fillout.com
 * and creates both a CRM contact and site member account in Wix.
 * 
 * Security: Protected by API key validation
 * Flow: Validate → Create Contact → Create Member → Store Application
 * 
 * @param {Request} request - HTTP request containing application data
 * @returns {Response} Success with created IDs or error with details
 */
export async function post_helloWebhook(request) {
    try {
        // API key validation
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        if (receivedApiKey !== storedApiKey) {
            return forbidden({ body: "Invalid API Key" });
        }

        const payload = await request.body.json();
        
        // Email validation
        if (!payload.email) {
            return badRequest({ body: "Email is required in the payload" });
        }
        console.log("Processing studio application for email:", payload.email);

        // Sequential operations
        const contactId = await findOrCreateContact(payload);
        const { memberId, memberData } = await findOrCreateMember(contactId, payload.email);
        const applicationData = buildApplicationData(payload, memberId);

        // Create application record
        const newApplication = await wixData.insert(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData, {suppressAuth: true});
        console.log("New Studio Application record created with ID:", newApplication._id);

        // TODO: Re-enable bidirectional linking
        // if (memberData) {
        //     await updateMemberWithApplication(memberId, memberData, newApplication._id);
        // }

        return ok({
            body: {
                status: "success",
                message: "Studio application processed successfully. Set password email sent if required.",
                data: { contactId, memberId, applicationId: newApplication._id }
            }
        });
    } catch (error) {
        console.error("Error in webhook:", error.message);
        return serverError({
            body: {
                status: "error",
                message: `Webhook processing failed: ${error.message}`
            }
        });
    }
}

/**
 * Finds or creates a CRM contact record.
 * Exported for testing.
 * 
 * @param {object} payload - Application form data
 * @returns {Promise<string>} Contact ID (existing or newly created)
 */
export async function findOrCreateContact(payload) {
    const contactInfo = {
        name: { first: payload.firstName || "", last: payload.lastName || "" },
        emails: [{ tag: 'MAIN', email: payload.email }],
        phones: payload.phone ? [{ tag: 'MOBILE', phone: payload.phone }] : [],
    };
    
    const result = await elevate(contacts.appendOrCreateContact)(contactInfo);
    console.log(`Processed contact with ID: ${result.contactId}.`);
    return result.contactId;
}

/**
 * Finds existing site member or creates new one with welcome email.
 * Exported for testing.
 * 
 * @param {string} contactId - CRM contact ID to link with member
 * @param {string} email - Email for member registration
 * @returns {Promise<{memberId: string, memberData: object}>} Member details
 */
export async function findOrCreateMember(contactId, email) {
    let member;
    
    // Check for existing member
    const memberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
        .eq("contactId", contactId)
        .find();

    if (memberQuery.items.length > 0) {
        member = memberQuery.items[0];
        console.log(`Found existing Member ID: ${member._id}`);
        return { memberId: member._id, memberData: member };
    } else {
        try {
            // Create new member
            // TODO: Generate secure password instead of hardcoded one
            const registerMemberResult = await authentication.register(email, "password123");
            member = registerMemberResult.member;
            console.log(`Created new member with ID: ${member._id}`);
            
            // Send password setup email
            await authentication.sendSetPasswordEmail(email);
            console.log(`Password setup email sent to ${email}`);
            return { memberId: member._id, memberData: member };
        } catch (error) {
            console.error(`Error creating member for contact ${contactId}:`, error.message);
            throw new Error(`Failed to create member account: ${error.message}`);
        }
    }
}

/**
 * Transforms raw form data into structured application record.
 * Exported for testing.
 * 
 * @param {object} payload - Raw form submission data
 * @param {string} memberId - Associated member ID for linking
 * @returns {object} Cleaned application data ready for database
 */
export function buildApplicationData(payload, memberId) {
    const applicationData = {
        // Link to member account
        applicant: memberId,
        
        // Unique ID from form system
        applicationID: payload.applicationID,
        
        // Contact information
        email: payload.email,
        firstName: payload.firstName || "",
        lastName: payload.lastName || "",
        
        // Workflow tracking
        applicationStage: payload.applicationStage || "Applied",
        applicantStatus: payload.applicantStatus || "applicant",
        
        // Experience data
        hasExperience: payload.hasExperience || false,
        experienceDescription: payload.experienceDescription || "",
        hasTechniques: payload.hasTechniques || [],
        practiceDescription: payload.practiceDescription || "",
        
        // Safety knowledge
        knowsSafety: payload.knowsSafety || false,
        safetyDescription: payload.safetyDescription || "",
        
        // Business data
        purchaseIntention: payload.purchaseIntention || "",
        
        // Demographics
        selfID: payload.selfID || false,
        
        // Community fit
        communityCommitment: payload.communityCommitment || "",
        communityInterest: payload.communityInterest || "",
        
        // Contact info
        phone: payload.phone || "",
        address: payload.address || "",
        website: payload.website || "",
        instagram: payload.instagram || "",
        
        // Analytics
        source: payload.source || "",
        
        // Additional info
        questions: payload.questions || "",
        
        // Metadata
        submissionDate: new Date(),
        status: "pending",
        formSource: "fillout_form",
        
        // Original submission link
        filloutURL: payload.filloutURL || {}
    };
    
    // Clean empty fields
    Object.keys(applicationData).forEach(key => {
        if (applicationData[key] === undefined || applicationData[key] === "") {
            delete applicationData[key];
        }
    });
    return applicationData;
}

/**
 * Creates bidirectional link between member and application records.
 * Currently disabled but exported for future use and testing.
 * 
 * @param {string} memberId - Member record to update
 * @param {object} memberData - Current member data with existing applications
 * @param {string} applicationId - New application to link
 */
export async function updateMemberWithApplication(memberId, memberData, applicationId) {
    if (!memberData) {
        console.warn(`Cannot update member record for memberId ${memberId} because memberData is missing.`);
        return;
    }
    try {
        const existingApplications = memberData.studioApplications || [];
        const memberUpdateData = {
            _id: memberId,
            studioApplications: [...existingApplications, applicationId],
            lastApplicationDate: new Date()
        };
        await wixData.update(MEMBERS_COLLECTION_ID, memberUpdateData);
        console.log("Updated member record with new application reference.");
    } catch (memberUpdateError) {
        console.warn("Could not update member record:", memberUpdateError.message);
    }
}

// Simple GET endpoint for basic connectivity testing
export function get_hello(request) {
    return ok({
        body: "Hello from Wix Backend!",
        headers: {
            'Content-Type': 'text/plain'
        }
    });
}

// Simple POST endpoint for testing JSON parsing
export function post_hello(request) {
    return request.body.json()
        .then(data => {
            return ok({
                body: `Hello, ${data.name || 'World'}!`,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        })
        .catch(() => {
            return badRequest({
                body: "Invalid JSON in request body"
            });
        });
}

/**
 * Main test runner endpoint
 * Access: https://yoursite.com/_functions/runTests
 * 
 * Security: Requires admin authentication
 * Returns: JSON with test results
 */
export async function get_runTests(request) {
    try {
        // Security check - only allow admins to run tests
        const member = await authentication.currentMember();
        if (!member || !member.role || member.role.name !== 'Admin') {
            return forbidden({
                body: {
                    error: 'Unauthorized. Admin access required to run tests.'
                }
            });
        }
        
        console.log(`[TEST RUNNER] Starting test suite - triggered by ${member.loginEmail}`);
        
        // Run all tests
        const results = await runAllTests();
        
        // Return formatted results
        return ok({
            body: results,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error) {
        console.error('[TEST RUNNER] Error:', error);
        return serverError({
            body: {
                error: 'Test suite failed',
                message: error.message
            }
        });
    }
}

/**
 * Run individual test endpoint
 * Access: https://yoursite.com/_functions/runTest?test=contactCreation
 * 
 * Available tests:
 * - contactCreation
 * - memberCreation
 * - applicationDataBuilding
 * - fullWebhookFlow
 * - invalidApiKey
 * - missingEmail
 */
export async function get_runTest(request) {
    try {
        // Security check
        const member = await authentication.currentMember();
        if (!member || !member.role || member.role.name !== 'Admin') {
            return forbidden({
                body: {
                    error: 'Unauthorized. Admin access required to run tests.'
                }
            });
        }
        
        // Get test name from query parameter
        const testName = request.query.test;
        if (!testName) {
            return ok({
                body: {
                    error: 'Missing test parameter',
                    availableTests: [
                        'contactCreation',
                        'memberCreation',
                        'applicationDataBuilding',
                        'fullWebhookFlow',
                        'invalidApiKey',
                        'missingEmail'
                    ]
                }
            });
        }
        
        console.log(`[TEST RUNNER] Running individual test: ${testName}`);
        
        // Map test names to functions
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
            return ok({
                body: {
                    error: `Unknown test: ${testName}`,
                    availableTests: Object.keys(testMap)
                }
            });
        }
        
        // Run the specific test
        const result = await testFunction();
        
        return ok({
            body: result,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error) {
        console.error('[TEST RUNNER] Error:', error);
        return serverError({
            body: {
                error: 'Test failed',
                message: error.message
            }
        });
    }
}

/**
 * Test health check endpoint
 * Access: https://yoursite.com/_functions/testHealth
 * 
 * Use this to verify the test system is working
 */
export async function get_testHealth(request) {
    return ok({
        body: {
            status: 'healthy',
            message: 'Test system is operational',
            timestamp: new Date().toISOString(),
            endpoints: {
                runAllTests: '/_functions/runTests',
                runSingleTest: '/_functions/runTest?test=testName',
                health: '/_functions/testHealth'
            }
        }
    });
}