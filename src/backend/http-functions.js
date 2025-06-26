// --- Imports ---
import { contacts } from 'wix-crm-backend';
import { authentication } from 'wix-members-backend';
import { ok, serverError, forbidden, badRequest } from 'wix-http-functions';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import { fetch } from 'wix-fetch';

// --- Constants ---
// Using the exact secret names you provided.
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
const REST_API_KEY_NAME = "MEMBER_MANAGEMENT_API_KEY";
const ACCOUNT_HEADER_NAME = "ACCOUNT_API_HEADER";

const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
const STUDIO_APPLICATIONS_COLLECTION_ID = "Import1";
const WIX_CREATE_MEMBER_API_URL = "https://www.wixapis.com/members/v1/members";

// CORS issues??
// --- NEW PREFLIGHT HANDLER ---
// Handles the OPTIONS request from the client
export function options_helloWebhook(request) {
  // Immediately respond with OK and the necessary CORS headers
  return ok({
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key"
    }
  });
}

// --- UPDATED POST HANDLER ---
// The simplified version of your original function
export async function post_helloWebhook(request) {
  console.log("post_helloWebhook was reached!");

  // Return a successful response WITH the CORS header
  return ok({
    body: {
      "status": "connected"
    },
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  });
}



/**
 * Hello, world. With a POST and JSON body. To test connectivity.
 */
export async function post_hello(request) {

    console.log("post_helloWebhook was reached!");
    return ok({ "body": { "status": "connected" } });
/*
  try {
    // 1. Get the body of the request
    const body = await request.body.json();

    const name = body.name || "World"; // Use "World" as a default

    console.log(`post_hello was called with the name: ${name}`);

    // 2. Create a success response
    const response = {
      "headers": { "Content-Type": "application/json" },
      "body": { "message": `Hello, ${name}` }
    };

    return ok(response);

  } catch (error) {
    console.error("Error in post_hello:", error);
    // 3. Create an error response if something goes wrong
    return badRequest({
      "body": { "error": "Could not parse JSON body." }
    });
  }
    */
}



/**
 * Finds a contact by email or creates/appends one.
 * @param {object} payload - The webhook payload from the form submission.
 * @returns {Promise<string>} The ID of the found or created contact.
 */
async function findOrCreateContact(payload) {
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
 * Finds a site member or creates them and sends a set password email.
 * @param {string} contactId - The ID of the contact record.
 * @param {string} email - The email of the applicant.
 * @returns {Promise<{memberId: string, memberData: object}>} An object containing the new member's ID and data.
 */
async function findOrCreateMember(contactId, email) {
    let member;
    const memberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
        .eq("contactId", contactId)
        .find();

    if (memberQuery.items.length > 0) {
        member = memberQuery.items[0];
        console.log(`Found existing Member ID: ${member._id}`);
        return { memberId: member._id, memberData: member };
    } else {
        try {
            const registerMemberResult = await authentication.register(email, "password123");
            member = registerMemberResult.member;
            console.log(`Created new member with ID: ${member._id}`);
            await authentication.sendSetPasswordEmail(email);
            console.log(`Password setup email sent to ${email}`);
            return { memberId: member._id, memberData: member };
        } catch (error) {
            console.warn(`Error creating member ${contactId}:`, error.message);
            if(member) return { memberId: member._id, memberData: member };
        }
    }
}

/**
 * Builds the complete application data object to be inserted into the CMS.
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
        website: payload.website || "",
        instagram: payload.instagram || "",
        source: payload.source || "",
        questions: payload.questions || "",
        submissionDate: new Date(),
        status: "pending",
        formSource: "fillout_form",
        filloutURL: payload.filloutURL || {}
    };
    Object.keys(applicationData).forEach(key => {
        if (applicationData[key] === undefined || applicationData[key] === "") {
            delete applicationData[key];
        }
    });
    return applicationData;
}

/**
 * Updates the member record with a reference to the new application.
 */
async function updateMemberWithApplication(memberId, memberData, applicationId) {
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

/**
 * Main webhook handler for form submissions.
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
            return serverError({ body: "Email is required in the payload" });
        }
        console.log("Processing studio application for email:", payload.email);

        const contactId = await findOrCreateContact(payload);
        const { memberId, memberData } = await findOrCreateMember(contactId, payload.email);
        const applicationData = buildApplicationData(payload, memberId);

        const newApplication = await wixData.insert(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData, {suppressAuth: true});
        console.log("New Studio Application record created with ID:", newApplication._id);

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
 * Standalone test function for debugging the Create Member REST API call.
 */
export async function get_testMemberCreation(request) {
    console.log("Running minimal test case for Create Member API...");

    // IMPORTANT: Replace this with a REAL contactId from your logs
    // that you know is NOT already a site member.
    const testContactId = "861a9d91-4875-442a-a23c-7413affaac86";

    try {
        const wixApiKey = await getSecret(REST_API_KEY_NAME);
        const wixAccountHeader = await getSecret(ACCOUNT_HEADER_NAME);

        if (!wixApiKey || !wixAccountHeader) {
            const secretErrorMsg = `TEST FAILED: One or more required secrets were not found.`;
            console.error(secretErrorMsg);
            return serverError({ body: secretErrorMsg });
        }

        const createMemberBody = {
            member: { contactId: testContactId }
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${wixApiKey}`,
                'wix-account-id': wixAccountHeader
            },
            body: JSON.stringify(createMemberBody)
        };

        console.log("Making fetch call to:", WIX_CREATE_MEMBER_API_URL);
        const response = await fetch(WIX_CREATE_MEMBER_API_URL, fetchOptions);
        const responseText = await response.text();

        console.log(`API response status: ${response.status}`);
        console.log("API response body:", responseText);

        if (response.ok) {
            return ok({ body: `SUCCESS: ${responseText}` });
        } else {
            return serverError({ body: `FAILURE: Status ${response.status}, Body: ${responseText}` });
        }

    } catch (error) {
        console.error("TEST FAILED with error:", error.message);
        return serverError({ body: `TEST FAILED: ${error.message}` });
    }
}


export async function handleApplication(payload) {
    console.log("Handling application with payload:", payload);
    const { email } = payload;
    if (!email) {
        throw new Error("Email is required in the payload");
    }


}
