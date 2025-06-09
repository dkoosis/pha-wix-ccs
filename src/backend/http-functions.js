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
            console.error("Invalid API Key received");
            return forbidden({ "error": "Invalid API Key" });
        }

        // 2. Get the application data from the request body
        const payload = await request.body.json();
        console.log("Received payload:", JSON.stringify(payload, null, 2));

        // Validate required fields
        const email = payload.email;
        if (!email) {
            return serverError({ 
                status: "error", 
                message: "Email is required in the payload" 
            });
        }

        // 3. Find or Create the Contact
        let contactId;
        const existingContacts = await elevate(contacts.queryContacts)({ 
            filter: { "emails.email": email } 
        });

        // Prepare contact information from payload
        const contactInfo = {
            name: {
                first: payload.firstName || payload.first_name || "",
                last: payload.lastName || payload.last_name || ""
            },
            emails: [{ tag: "MAIN", email: email }],
            phones: payload.phone ? [{ tag: "MAIN", phone: payload.phone }] : [],
            // Add any other contact fields you want to update
            ...(payload.company && { company: payload.company }),
            ...(payload.jobTitle && { jobTitle: payload.jobTitle })
        };

        if (existingContacts.items.length > 0) {
            contactId = existingContacts.items[0]._id;
            await elevate(contacts.updateContact)(contactId, contactInfo);
            console.log(`Updated existing contact: ${contactId}`);
        } else {
            const newContact = await elevate(contacts.createContact)(contactInfo);
            contactId = newContact.contact._id;
            console.log(`Created new contact: ${contactId}`);
        }

        // 4. Find the Member ID using the Contact ID
        let memberId;
        const memberQuery = await wixData.query(MEMBERS_COLLECTION_ID)
            .eq("contactId", contactId)
            .find();
        
        if (memberQuery.items.length > 0) {
            memberId = memberQuery.items[0]._id;
            console.log(`Found Member ID: ${memberId} for Contact ID: ${contactId}`);
        } else {
            // This person is a contact, but not a site member.
            console.error(`Error: A contact exists for ${email} (ID: ${contactId}), but they are not a site member.`);
            return serverError({ 
                status: "error", 
                message: `Applicant with email ${email} is not a registered site member. They need to create an account first.` 
            });
        }
        
        // 5. Prepare and Create the Application Item in the "Studio Applications" collection
        const applicationData = {
            // Reference field linking to the Member
            applicant: memberId, // Make sure this matches your collection's reference field name
            
            // Basic application info
            applicationID: payload.applicationID || payload.application_id,
            email: email,
            firstName: payload.firstName || payload.first_name || "",
            lastName: payload.lastName || payload.last_name || "",
            
            // Application specific fields - adjust these based on your actual form fields
            experienceDescription: payload.experienceDescription || payload.experience_description || "",
            portfolioUrl: payload.portfolioUrl || payload.portfolio_url || "",
            projectDescription: payload.projectDescription || payload.project_description || "",
            skillLevel: payload.skillLevel || payload.skill_level || "",
            availability: payload.availability || "",
            motivation: payload.motivation || "",
            previousExperience: payload.previousExperience || payload.previous_experience || "",
            
            // Metadata
            submissionDate: new Date(),
            status: "pending", // Default status
            source: "fillout_form",
            
            // Add any other fields from your form
            ...(payload.phone && { phone: payload.phone }),
            ...(payload.company && { company: payload.company }),
            ...(payload.website && { website: payload.website }),
            ...(payload.linkedinProfile && { linkedinProfile: payload.linkedinProfile }),
            ...(payload.instagramHandle && { instagramHandle: payload.instagramHandle }),
            
            // Handle any custom fields or additional data
            ...(payload.additionalNotes && { additionalNotes: payload.additionalNotes }),
            ...(payload.referralSource && { referralSource: payload.referralSource }),
            ...(payload.timeCommitment && { timeCommitment: payload.timeCommitment }),
        };

        // Remove any undefined values to keep the data clean
        Object.keys(applicationData).forEach(key => {
            if (applicationData[key] === undefined || applicationData[key] === "") {
                delete applicationData[key];
            }
        });

        console.log("Creating application with data:", JSON.stringify(applicationData, null, 2));

        // Insert the application record
        const newApplication = await elevate(wixData.insert)(STUDIO_APPLICATIONS_COLLECTION_ID, applicationData);
        console.log("New Studio Application record created with ID:", newApplication._id);

        // 6. Optional: Update member record with application reference
        try {
            const memberData = memberQuery.items[0];
            const existingApplications = memberData.studioApplications || [];
            
            await wixData.update(MEMBERS_COLLECTION_ID, memberId, {
                studioApplications: [...existingApplications, newApplication._id],
                lastApplicationDate: new Date()
            });
            console.log("Updated member record with new application reference");
        } catch (memberUpdateError) {
            console.warn("Could not update member record with application reference:", memberUpdateError.message);
            // Don't fail the whole operation if this optional step fails
        }

        // 7. Return a success response
        return ok({
            status: "success",
            message: "Contact processed and studio application created successfully.",
            data: {
                contactId: contactId,
                memberId: memberId,
                applicationId: newApplication._id,
                email: email,
                submissionDate: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("Error in webhook:", error);
        return serverError({ 
            status: "error", 
            message: `Webhook processing failed: ${error.message}`,
            timestamp: new Date().toISOString()
        });
    }
}