import { Permissions, webMethod } from 'wix-web-module';
import { contacts } from 'wix-crm.v2';

export const processWebhook = webMethod(Permissions.Anyone, async (payload) => {
    // Extract contact info from payload
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