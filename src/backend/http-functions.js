// --- Imports ---
import { contacts } from 'wix-crm-backend';
import { ok, serverError, forbidden } from 'wix-http-functions';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import { fetch } from 'wix-fetch';

// --- Constants ---
const FILLOUT_API_KEY_NAME = "FILLOUT_X_API_KEY"; 
const WIX_REST_API_KEY_NAME = "MEMBER_MANAGEMENT_API_KEY";  
const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
const STUDIO_APPLICATIONS_COLLECTION_ID = "Studio Applications";
const WIX_INVITE_API_URL = "https://www.wixapis.com/v1/users/invite"; // The official Wix REST API endpoint

/**
 * Finds a contact by email or creates/appends one.
 */
async function findOrCreateContact(payload) {
    const contactInfo = {
        name: {
            first: payload.firstName || "",
            last: payload.lastName || ""
        },
        emails: [{ tag: 'MAIN', email: payload.email }],
        phones: payload.phone ? [{ tag: 'MOBILE', phone: payload.phone }] : [],
    };

    const result = await elevate(contacts.appendOrCreateContact)(contactInfo);
    console.log(`Processed contact with ID: ${result.contactId}.`);
    return result.contactId;
}

/**
 * Finds a site member using their contact ID. If the member does not exist,
 * it uses the Wix REST API to send a site membership invitation.
 */
/**
 * Finds a site member using their contact ID. If the member does not exist,
 * it uses the Wix REST API to send a site membership invitation.
 */
async function findMemberByContactId(contactId, email) {
    // CORRECTED: The REST API endpoint for inviting members
    const WIX_INVITE_API_URL = "https://www.wixapis.com/members/v1/invites";

    let memberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
        .eq("contactId", contactId)
        .find();
    
    if (memberQuery.items.length > 0) {
        const member = memberQuery.items[0];
        console.log(`Found existing Member ID: ${member._id}`);
        return { memberId: member._id, memberData: member };
    } else {
        console.log(`Contact is not a member. Sending invitation to ${email} via REST API...`);
        const wixApiKey = await getSecret(WIX_REST_API_KEY_NAME);

        // CORRECTED: The request body for this endpoint invites by contactId and assigns a role.
        const requestBody = {
            "contactId": contactId,
            "roles": [{ "name": "Member" }] // Assigns the default "Member" role
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': wixApiKey
            },
            body: JSON.stringify(requestBody)
        };

        const response = await fetch(WIX_INVITE_API_URL, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to send invitation via REST API: ${errorText}`);
        }
        
        console.log("Invitation sent successfully. Finding new pending member record...");
        
        const newMemberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
            .eq("contactId", contactId)
            .find();
        
        if (newMemberQuery.items.length > 0) {
            const newMember = newMemberQuery.items[0];
            console.log(`Found new pending Member ID: ${newMember._id}`);
            return { memberId: newMember._id, memberData: newMember };
        } else {
            throw new Error(`Failed to find member record for ${email} after sending invitation.`);
        }
    }
}

function buildApplicationData(payload, memberId) {
    // ... (This function is complete and correct from our previous version)
}

async function updateMemberWithApplication(memberId, memberData, applicationId) {
    // ... (This function is complete and correct from our previous version)
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
        const { memberId, memberData } = await findMemberByContactId(contactId, payload.email);
        const applicationData = buildApplicationData(payload, memberId);
        
        const newApplication = await wixData.insert(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData);
        console.log("New Studio Application record created with ID:", newApplication._id);

        await updateMemberWithApplication(memberId, memberData, newApplication._id);

        return ok({
            body: {
                status: "success",
                message: "Studio application processed successfully. Invitation sent if required.",
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