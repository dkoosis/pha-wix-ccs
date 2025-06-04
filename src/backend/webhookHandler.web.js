import { Permissions, webMethod } from 'wix-web-module';
import { contacts } from 'wix-crm.v2';

export const debugWebhook = webMethod(Permissions.Anyone, async (payload) => {
    console.log("=== WEBHOOK PAYLOAD RECEIVED ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Payload type:", typeof payload);
    console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("=== END WEBHOOK PAYLOAD ===");

    return { 
        status: "success", 
        message: "Payload logged successfully",
        receivedAt: new Date().toISOString()
    };
});

export const processWebhook = webMethod(Permissions.Anyone, async (payload) => {
    const contactInfo = {
        name: {
            first: payload.firstName,
            last: payload.lastName
        },
        emails: {
            items: [
                { email: payload.email }
            ]
        },
        phones: {
            items: [
                { phone: payload.phone }
            ]
        }
    };

    try {
        const newContact = await contacts.createContact(contactInfo);
        return { status: "Processed", contact: newContact };
    } catch (error) {
        console.error("Error creating contact:", error);
        throw new Error("Failed to create contact");
    }
});