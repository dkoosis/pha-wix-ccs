// src/backend/http-functions.js
import { ok, serverError } from 'wix-http-functions';
import { contacts } from 'wix-crm.v2';

export async function post_helloWebhook(request) {
    try {
        console.log("=== HELLO WORLD WEBHOOK ===");
        console.log("Received request at:", new Date().toISOString());
        
        // Parse the incoming JSON payload (even though we're not using it yet)
        let payload = {};
        try {
            payload = await request.body.json();
            console.log("Received payload:", JSON.stringify(payload, null, 2));
        } catch (jsonError) {
            console.log("No valid JSON payload, proceeding anyway");
        }
        
        // Create hardcoded "John Smith" contact
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

        // Create the contact
        const newContact = await contacts.createContact(contactInfo);
        console.log("Contact created successfully:", newContact.contact._id);
        
        return ok({
            status: "success",
            message: "Hello World! John Smith contact created",
            contactId: newContact.contact._id,
            timestamp: new Date().toISOString(),
            receivedPayload: payload
        });
        
    } catch (error) {
        console.error("Error in hello webhook:", error);
        return serverError({ 
            status: "error",
            message: error.message, 
            timestamp: new Date().toISOString()
        });
    }
}