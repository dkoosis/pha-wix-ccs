// src/backend/http-functions.js
import { ok, serverError } from 'wix-http-functions';
import { contacts } from 'wix-crm.v2';

// Increment this version number with each new deployment to test.
const DEPLOYMENT_VERSION = "1.0";

export async function post_helloWebhook(request) {
    try {
        console.log(`=== HELLO WORLD WEBHOOK (Version: ${DEPLOYMENT_VERSION}) ===`);
        console.log("Received request at:", new Date().toISOString());

        let payload = {};
        try {
            payload = await request.body.json();
            console.log("Received payload:", JSON.stringify(payload, null, 2));
        } catch (jsonError) {
            console.log("No valid JSON payload, proceeding anyway");
        }

        const contactInfo = {
            name: {
                first: "John",
                last: "Smith"
            },
            emails: {
                items: [
                    { email: "john.smith@example.com" }
                ]
            },
            phones: {
                items: [
                    { phone: "+1-555-0123" }
                ]
            }
        };

        const newContact = await contacts.createContact(contactInfo);
        console.log("Contact created successfully:", newContact.contact._id);

        return ok({
            status: "success",
            message: "Hello World! John Smith contact created",
            version: DEPLOYMENT_VERSION, // You can check for this in the response
            contactId: newContact.contact._id,
            timestamp: new Date().toISOString(),
            receivedPayload: payload
        });

    } catch (error) {
        console.error("Error in hello webhook:", error);
        return serverError({
            status: "error",
            message: error.message,
            version: DEPLOYMENT_VERSION,
            timestamp: new Date().toISOString()
        });
    }
}