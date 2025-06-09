// --- Imports ---
// Using the stable 'wix-crm-backend' API for simplicity and reliability
import { contacts } from 'wix-crm-backend'; 
import { ok, serverError, forbidden } from 'wix-http-functions';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// --- Constants ---
const WIX_SECRET_NAME = "FILLOUT_X_API_KEY";
const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
const STUDIO_APPLICATIONS_COLLECTION_ID = "Studio Applications";

/**
 * Finds a contact by email or creates one if they don't exist.
 * Uses the correct `appendOrCreateContact` function and its signature.
 * @param {object} payload - The webhook payload containing applicant data.
 * @returns {Promise<string>} The ID of the found or created contact.
 */
async function findOrCreateContact(payload) {
    // This contactInfo object is correct.
    const contactInfo = {
        name: {
            first: payload.firstName || "",
            last: payload.lastName || ""
        },
        emails: [{ tag: 'MAIN', email: payload.email }],
        phones: payload.phone ? [{ tag: 'MOBILE', phone: payload.phone }] : [],
    };

    // CORRECTED: Pass the contactInfo object directly as the argument.
    const result = await elevate(contacts.appendOrCreateContact)(contactInfo);
    
    // CORRECTED: The returned object does not have an 'isNew' property.
    // The appendOrCreateContact function handles updates to empty fields automatically,
    // so the separate 'update' call is no longer needed.
    const contactId = result.contactId;
    
    console.log(`Processed contact with ID: ${contactId}.`);
    
    return contactId;
}

/**
 * Finds a site member using their contact ID.
 * @param {string} contactId - The ID of the contact.
 * @param {string} email - The email of the contact, for logging purposes.
 * @returns {Promise<{memberId: string, memberData: object}>}
 */
async function findMemberByContactId(contactId, email) {
    const memberQuery = await wixData.query(MEMBERS_COLLECTION_ID)
        .eq("contactId", contactId)
        .find();
    
    if (memberQuery.items.length > 0) {
        const member = memberQuery.items[0];
        console.log(`Found Member ID: ${member._id} for Contact ID: ${contactId}`);
        return { memberId: member._id, memberData: member };
    } else {
        throw new Error(`Applicant with email ${email} is not a registered site member.`);
    }
}

/**
 * Builds the application data object to be inserted into the CMS.
 * @param {object} payload - The webhook payload.
 * @param {string} memberId - The ID of the member to link the application to.
 * @returns {object}
 */
function buildApplicationData(payload, memberId) {
    const applicationData = {
        applicant: memberId,
        applicationID: payload.applicationID,
        email: payload.email,
        firstName: payload.firstName || "",
        lastName: payload.lastName || "",
        applicationStage: payload.applicationStage || "Applied",
        applicantStatus: payload.applicantStatus || "applicant",
        hasExperience: payload.hasExperience || false,
        experienceDescription: payload.experienceDescription || "",
        hasTechniques: payload.hasTechniques || [],
        practiceDescription: payload.practiceDescription || "",
        knowsSafety: payload.knowsSafety || false,
        safetyDescription: payload.safetyDescription || "",
        purchaseIntention: payload.purchaseIntention || "",
        selfID: payload.selfID || false,
        communityCommitment: payload.communityCommitment || "",
        communityInterest: payload.communityInterest || "",
        phone: payload.phone || "",
        address: payload.address || "",
        source: payload.source || "",
        questions: payload.questions || "",
        submissionDate: new Date(),
        status: "pending",
        formSource: "fillout_form",
        filloutURL: payload.filloutURL || {}
    };

    // Clean up empty values before insertion
    Object.keys(applicationData).forEach(key => {
        if (applicationData[key] === undefined || applicationData[key] === "") {
            delete applicationData[key];
        }
    });

    return applicationData;
}

/**
 * Updates the member record with a reference to the new application.
 * @param {string} memberId - The ID of the member to update.
 * @param {object} memberData - The original data record of the member.
 * @param {string} applicationId - The ID of the newly created application.
 */
async function updateMemberWithApplication(memberId, memberData, applicationId) {
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
        console.warn("Could not update member record with application reference:", memberUpdateError.message);
    }
}

/**
 * Main webhook handler for form submissions.
 */
export async function post_helloWebhook(request) {
    try {
        // 1. Authenticate Request
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(WIX_SECRET_NAME);
        if (receivedApiKey !== storedApiKey) {
            return forbidden({ body: "Invalid API Key" });
        }

        // 2. Get and Validate Payload
        const payload = await request.body.json();
        if (!payload.email) {
            return serverError({ body: "Email is required in the payload" });
        }
        console.log("Processing studio application for email:", payload.email);

        // 3. Process Data using Helper Functions
        const contactId = await findOrCreateContact(payload);
        const { memberId, memberData } = await findMemberByContactId(contactId, payload.email);
        const applicationData = buildApplicationData(payload, memberId);
        
        const newApplication = await wixData.insert(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData);
        console.log("New Studio Application record created with ID:", newApplication._id);

        await updateMemberWithApplication(memberId, memberData, newApplication._id);

        // 4. Return Success Response
        return ok({
            body: {
                status: "success",
                message: "Studio application processed successfully.",
                data: {
                    contactId: contactId,
                    memberId: memberId,
                    applicationId: newApplication._id
                }
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