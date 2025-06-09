// Import necessary Wix APIs
import { ok, serverError, forbidden } from 'wix-http-functions';
import { contacts } from 'wix-crm.v2';
import { elevate } from 'wix-auth';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// The name of your secret in Wix Secrets Manager
const WIX_SECRET_NAME = "FILLOUT_X_API_KEY";
// The collection ID for your members data. VERIFY THIS in your CMS.
const MEMBERS_COLLECTION_ID = "Members/PrivateMembersData";
// The collection ID for studio applications
const STUDIO_APPLICATIONS_COLLECTION_ID = "Studio Applications";

export async function post_helloWebhook(request) {
    try {
        // 1. Authenticate the request
        const receivedApiKey = request.headers['x-api-key'];
        const storedApiKey = await getSecret(WIX_SECRET_NAME);
        if (receivedApiKey !== storedApiKey) {
            return forbidden({ body: "Invalid API Key" });
        }

        // 2. Get and validate the payload
        const payload = await request.body.json();
        const email = payload.email;
        if (!email) {
            return serverError({ body: "Email is required in the payload" });
        }
        console.log("Received payload for email:", email);

        // 3. Find or Create the Contact
        let contactId;
        
        // === CORRECTED QUERY SYNTAX ===
        const existingContactsQuery = await elevate(contacts.queryContacts)({
            filter: { "emails.email": email }
        });

        // === CORRECTED OBJECT STRUCTURE ===
        const contactInfo = {
            name: {
                first: payload.firstName || "",
                last: payload.lastName || ""
            },
            emails: [{ tag: "MAIN", email: email }],
            phones: payload.phone ? [{ tag: "MAIN", phone: payload.phone }] : [],
            addresses: payload.address ? [{
                tag: "HOME",
                address: { formatted: payload.address }
            }] : [],
            customFields: {
                // Example: 'custom.website' must be the Field Key from the Wix CRM Contact List
                'custom.website': payload.website,
                'custom.instagram': payload.instagram
            }
        };

        if (existingContactsQuery.items.length > 0) {
            contactId = existingContactsQuery.items[0]._id;
            // For updates, the structure needs the contactInfo object directly
            await elevate(contacts.updateContact)(contactId, contactInfo);
            console.log(`Updated existing contact: ${contactId}`);
        } else {
            // For creation, the structure needs the contactInfo object
            const newContact = await elevate(contacts.createContact)(contactInfo);
            contactId = newContact.contact._id;
            console.log(`Created new contact: ${contactId}`);
        }

        // 4. Find the Member ID using the Contact ID (Logic is sound)
        let memberId;
        const memberQuery = await wixData.query(MEMBERS_COLLECTION_ID).eq("contactId", contactId).find();
        if (memberQuery.items.length > 0) {
            memberId = memberQuery.items[0]._id;
            console.log(`Found Member ID: ${memberId}`);
        } else {
            console.error(`Error: A contact exists for ${email}, but they are not a site member.`);
            return serverError({ body: `Applicant with email ${email} is not a registered site member.` });
        }
        
        // 5. Prepare and Create the Application Item (Logic is sound)
        const applicationData = {
            applicant: memberId,
            applicationID: payload.applicationID,
            // ... (the rest of your excellent applicationData object) ...
             email: email, // etc.
        };
        const newApplication = await elevate(wixData.insert)(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData);
        console.log("New Studio Application record created with ID:", newApplication._id);

        // 6. Optional: Update member record with application reference (Logic is sound)
        try {
            const memberData = memberQuery.items[0];
            const existingApplications = memberData.studioApplications || [];
            await elevate(wixData.update)(MEMBERS_COLLECTION_ID, memberId, {
                studioApplications: [...existingApplications, newApplication._id],
                lastApplicationDate: new Date()
            });
            console.log("Updated member record with new application reference");
        } catch (memberUpdateError) {
            console.warn("Could not update member record:", memberUpdateError.message);
        }

        // 7. Return a success response (Logic is sound)
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
        console.error("Error in webhook:", error);
        return serverError({ body: { status: "error", message: error.message } });
    }
}