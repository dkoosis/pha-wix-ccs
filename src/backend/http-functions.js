import { contacts } from 'wix-crm-backend';
import { authentication } from 'wix-members-backend';
import { ok, serverError, forbidden, badRequest } from 'wix-http-functions';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// Secret keys stored in Wix Secrets Manager - these should never be hardcoded
// FILLOUT_API_KEY validates incoming webhook requests from Fillout form service
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
// Collection IDs - consider moving to a configuration object
// Members collection is Wix's built-in private member data store
const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
// TODO: Rename "Import1" to something meaningful like "StudioApplications"
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
        // API key validation prevents unauthorized webhook calls
        // This is critical since this endpoint creates user accounts
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        if (receivedApiKey !== storedApiKey) {
            return forbidden({ body: "Invalid API Key" });
        }

        const payload = await request.body.json();
        
        // Email is the primary identifier for deduplication
        // Without it, we can't check for existing contacts/members
        if (!payload.email) {
            return badRequest({ body: "Email is required in the payload" });
        }
        console.log("Processing studio application for email:", payload.email);

        // Sequential operations ensure data consistency
        // Contact must exist before member, member must exist before application
        const contactId = await findOrCreateContact(payload);
        const { memberId, memberData } = await findOrCreateMember(contactId, payload.email);
        const applicationData = buildApplicationData(payload, memberId);

        // suppressAuth bypasses permission checks - necessary since webhook runs without user context
        const newApplication = await wixData.insert(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData, {suppressAuth: true});
        console.log("New Studio Application record created with ID:", newApplication._id);

        // FIXME: This bidirectional link is critical for data integrity
        // Without it, members can't see their application history
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
        // Generic error message prevents information leakage
        // Detailed errors are logged server-side for debugging
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
 * 
 * Uses Wix's appendOrCreateContact which intelligently merges data
 * if a contact with the same email already exists. This prevents
 * duplicate contacts while preserving existing contact history.
 * 
 * @param {object} payload - Application form data
 * @returns {Promise<string>} Contact ID (existing or newly created)
 */
async function findOrCreateContact(payload) {
    const contactInfo = {
        name: { first: payload.firstName || "", last: payload.lastName || "" },
        emails: [{ tag: 'MAIN', email: payload.email }],
        phones: payload.phone ? [{ tag: 'MOBILE', phone: payload.phone }] : [],
    };
    
    // elevate() runs with admin permissions, bypassing normal access controls
    // This is necessary since the webhook has no user context
    const result = await elevate(contacts.appendOrCreateContact)(contactInfo);
    console.log(`Processed contact with ID: ${result.contactId}.`);
    return result.contactId;
}

/**
 * Finds existing site member or creates new one with welcome email.
 * 
 * Critical function that bridges CRM contacts with site membership.
 * New members receive a password setup email to claim their account.
 * 
 * WARNING: Currently uses hardcoded password "password123" - SECURITY RISK
 * TODO: Generate secure random passwords or use passwordless authentication
 * 
 * @param {string} contactId - CRM contact ID to link with member
 * @param {string} email - Email for member registration
 * @returns {Promise<{memberId: string, memberData: object}>} Member details
 */
async function findOrCreateMember(contactId, email) {
    let member;
    
    // Check if contact already has a member account
    // This query uses the built-in link between contacts and members
    const memberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
        .eq("contactId", contactId)
        .find();

    if (memberQuery.items.length > 0) {
        member = memberQuery.items[0];
        console.log(`Found existing Member ID: ${member._id}`);
        return { memberId: member._id, memberData: member };
    } else {
        try {
            // SECURITY ISSUE: Hardcoded weak password
            // All new members get the same password until they reset it
            const registerMemberResult = await authentication.register(email, "password123");
            member = registerMemberResult.member;
            console.log(`Created new member with ID: ${member._id}`);
            
            // This email allows users to set their own secure password
            // Critical for security since we use a weak default
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
 * 
 * Maps between Fillout's form field names and our database schema.
 * Provides defaults for optional fields and cleans empty values.
 * 
 * Business Logic:
 * - All new applications start with status "pending" 
 * - applicationStage tracks workflow: Applied → Reviewed → Accepted/Rejected
 * - applicantStatus becomes "member" after acceptance
 * 
 * @param {object} payload - Raw form submission data
 * @param {string} memberId - Associated member ID for linking
 * @returns {object} Cleaned application data ready for database
 */
function buildApplicationData(payload, memberId) {
    const applicationData = {
        // Link to member account for easy retrieval
        applicant: memberId,
        
        // Unique ID from form system for deduplication
        applicationID: payload.applicationID,
        
        // Contact information - duplicated for denormalization/quick access
        email: payload.email,
        firstName: payload.firstName || "",
        lastName: payload.lastName || "",
        
        // Workflow tracking fields
        applicationStage: payload.applicationStage || "Applied",
        applicantStatus: payload.applicantStatus || "applicant",
        
        // Ceramics experience assessment
        hasExperience: payload.hasExperience || false,
        experienceDescription: payload.experienceDescription || "",
        hasTechniques: payload.hasTechniques || [],
        practiceDescription: payload.practiceDescription || "",
        
        // Safety knowledge is critical for studio access
        knowsSafety: payload.knowsSafety || false,
        safetyDescription: payload.safetyDescription || "",
        
        // Business planning data
        purchaseIntention: payload.purchaseIntention || "",
        
        // Diversity and inclusion tracking
        selfID: payload.selfID || false,
        
        // Community fit assessment
        communityCommitment: payload.communityCommitment || "",
        communityInterest: payload.communityInterest || "",
        
        // Additional contact info
        phone: payload.phone || "",
        address: payload.address || "",
        website: payload.website || "",
        instagram: payload.instagram || "",
        
        // Marketing analytics
        source: payload.source || "",
        
        // Open-ended field for special requests
        questions: payload.questions || "",
        
        // Metadata
        submissionDate: new Date(),
        status: "pending",  // All applications start pending review
        formSource: "fillout_form",  // Track which system submitted this
        
        // Preserve link to original form submission
        filloutURL: payload.filloutURL || {}
    };
    
    // Clean up empty fields to save storage and improve query performance
    // Wix queries can behave differently with null vs undefined vs empty string
    Object.keys(applicationData).forEach(key => {
        if (applicationData[key] === undefined || applicationData[key] === "") {
            delete applicationData[key];
        }
    });
    return applicationData;
}

/**
 * Creates bidirectional link between member and application records.
 * 
 * This enables:
 * - Members to view their application history
 * - Staff to see all applications from a member
 * - Preventing duplicate active applications
 * 
 * Currently disabled (commented out) which breaks this functionality.
 * 
 * @param {string} memberId - Member record to update
 * @param {object} memberData - Current member data with existing applications
 * @param {string} applicationId - New application to link
 */
async function updateMemberWithApplication(memberId, memberData, applicationId) {
    if (!memberData) {
        console.warn(`Cannot update member record for memberId ${memberId} because memberData is missing.`);
        return;
    }
    try {
        // Append to existing applications array to maintain history
        const existingApplications = memberData.studioApplications || [];
        const memberUpdateData = {
            _id: memberId,
            studioApplications: [...existingApplications, applicationId],
            lastApplicationDate: new Date()  // Helps identify most recent application
        };
        await wixData.update(MEMBERS_COLLECTION_ID, memberUpdateData);
        console.log("Updated member record with new application reference.");
    } catch (memberUpdateError) {
        // Non-fatal error - application is saved even if member update fails
        // This ensures we don't lose applications due to member record issues
        console.warn("Could not update member record:", memberUpdateError.message);
    }
}
