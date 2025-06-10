// --- Imports ---
import { contacts } from 'wix-crm-backend';
import { authentication } from 'wix-members-backend';
import { ok, serverError, forbidden } from 'wix-http-functions';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import { fetch } from 'wix-fetch';

// --- Constants ---
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY";
const WIX_REST_API_KEY_NAME = "MEMBER_MANAGEMENT_API_KEY";
const WIX_ACCOUNT_ID_KEY_NAME = "ACCOUNT_API_HEADER";
const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
const STUDIO_APPLICATIONS_COLLECTION_ID = "Studio Applications";
const WIX_CREATE_MEMBER_API_URL = "https://www.wixapis.com/members/v1/members";

/**
 * Finds a contact by email or creates/appends one.
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
 * Finds a site member, or creates one via the REST API and sends a set password email.
 */
async function findOrCreateMember(contactId, email) {
    const memberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
        .eq("contactId", contactId)
        .find();
    
    if (memberQuery.items.length > 0) {
        const member = memberQuery.items[0];
        console.log(`Found existing Member ID: ${member._id}`);
        return { memberId: member._id, memberData: member };
    } else {
        console.log(`Contact is not a member. Creating member for ${email} via REST API...`);
        const wixApiKey = await getSecret(WIX_REST_API_KEY_NAME);
        const wixAccountIdKey = await getSecret(WIX_ACCOUNT_ID_KEY_NAME);

        const createMemberBody = {
            member: { contactId: contactId }
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // CORRECTED: Added "Bearer " prefix to the API Key
                'Authorization': `Bearer ${wixApiKey}`,
                'wix-account-id': wixAccountIdKey
            },
            body: JSON.stringify(createMemberBody)
        };

        const response = await fetch(WIX_CREATE_MEMBER_API_URL, fetchOptions);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create member via REST API: ${errorText}`);
        }
        
        const responseData = await response.json();
        const newMember = responseData.member;
        console.log(`Member created successfully with ID: ${newMember.id}`);
        
        try {
            await elevate(authentication.sendSetPasswordEmail)(email);
            console.log(`Password setup email sent to ${email}`);
        } catch (emailError) {
             console.warn(`Member created but failed to send password email: ${emailError.message}`);
        }
        
        return { memberId: newMember.id, memberData: newMember };
    }
}

// ... (buildApplicationData and updateMemberWithApplication functions are correct)

function buildApplicationData(payload, memberId) {
    const applicationData = { applicant: memberId, applicationID: payload.applicationID, email: payload.email, firstName: payload.firstName || "", lastName: payload.lastName || "", applicationStage: payload.applicationStage || "Applied", applicantStatus: payload.applicantStatus || "applicant", hasExperience: payload.hasExperience || false, experienceDescription: payload.experienceDescription || "", hasTechniques: payload.hasTechniques || [], practiceDescription: payload.practiceDescription || "", knowsSafety: payload.knowsSafety || false, safetyDescription: payload.safetyDescription || "", purchaseIntention: payload.purchaseIntention || "", selfID: payload.selfID || false, communityCommitment: payload.communityCommitment || "", communityInterest: payload.communityInterest || "", phone: payload.phone || "", address: payload.address || "", website: payload.website || "", instagram: payload.instagram || "", source: payload.source || "", questions: payload.questions || "", submissionDate: new Date(), status: "pending", formSource: "fillout_form", filloutURL: payload.filloutURL || {} };
    Object.keys(applicationData).forEach(key => { if (applicationData[key] === undefined || applicationData[key] === "") { delete applicationData[key]; } });
    return applicationData;
}
async function updateMemberWithApplication(memberId, memberData, applicationId) {
    if (!memberData) { console.warn(`Cannot update member record for memberId ${memberId} because memberData is missing.`); return; }
    try {
        const existingApplications = memberData.studioApplications || [];
        const memberUpdateData = { _id: memberId, studioApplications: [...existingApplications, applicationId], lastApplicationDate: new Date() };
        await wixData.update(MEMBERS_COLLECTION_ID, memberUpdateData);
        console.log("Updated member record with new application reference.");
    } catch (memberUpdateError) { console.warn("Could not update member record:", memberUpdateError.message); }
}

/**
 * Main webhook handler
 */
export async function post_helloWebhook(request) {
    try {
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(FILLOUT_API_KEY_NAME);
        if (receivedApiKey !== storedApiKey) { return forbidden({ body: "Invalid API Key" }); }
        const payload = await request.body.json();
        if (!payload.email) { return serverError({ body: "Email is required in the payload" }); }
        console.log("Processing studio application for email:", payload.email);
        const contactId = await findOrCreateContact(payload);
        const { memberId, memberData } = await findOrCreateMember(contactId, payload.email);
        const applicationData = buildApplicationData(payload, memberId);
        const newApplication = await wixData.insert(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData);
        console.log("New Studio Application record created with ID:", newApplication._id);
        if (memberData) { await updateMemberWithApplication(memberId, memberData, newApplication._id); }
        return ok({ body: { status: "success", message: "Studio application processed successfully. Set password email sent if required.", data: { contactId, memberId, applicationId: newApplication._id } } });
    } catch (error) {
        console.error("Error in webhook:", error.message);
        return serverError({ body: { status: "error", message: `Webhook processing failed: ${error.message}` } });
    }
}

/**
 * Standalone test function
 */
export async function get_testMemberCreation(request) {
    console.log("Running minimal test case for Create Member API...");
    const testContactId = "REPLACE_WITH_A_REAL_CONTACT_ID";
    try {
        const wixApiKey = await getSecret(WIX_REST_API_KEY_NAME);
        const wixAccountIdKey = await getSecret(WIX_ACCOUNT_ID_KEY_NAME);
        if (!wixApiKey || !wixAccountIdKey) {
            const secretErrorMsg = `TEST FAILED: One or more required secrets were not found.`;
            console.error(secretErrorMsg);
            return serverError({ body: secretErrorMsg });
        }
        const createMemberBody = { member: { contactId: testContactId } };
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${wixApiKey}`,
                'wix-account-id': wixAccountIdKey
            },
            body: JSON.stringify(createMemberBody)
        };
        console.log("Making fetch call...");
        const response = await fetch(WIX_CREATE_MEMBER_API_URL, fetchOptions);
        const responseText = await response.text();
        console.log(`API response status: ${response.status}`);
        console.log("API response body:", responseText);
        if (response.ok) { return ok({ body: `SUCCESS: ${responseText}` }); } 
        else { return serverError({ body: `FAILURE: Status ${response.status}, Body: ${responseText}` }); }
    } catch (error) {
        console.error("TEST FAILED with error:", error.message);
        return serverError({ body: `TEST FAILED: ${error.message}` });
    }
}