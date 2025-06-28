// src/backend/contact-logic.web.js
// CRM Contact management logic

import { contacts } from 'wix-crm-backend';
import { elevate } from 'wix-auth';

/**
 * Find or create a CRM contact by email
 */
export async function findOrCreateContact(email, firstName = '', lastName = '') {
    if (!email) {
        throw new Error("Email is required to find or create a contact");
    }

    console.log(`[CRM] Looking for contact with email: ${email}`);

    try {
        // Search for existing contact by email
        // TODO: Confirm "info.emails.email" is still the correct query path
        // This worked in the original code but API might have changed
        const queryResult = await elevate(contacts.queryContacts)()
            .eq("info.emails.email", email)
            .limit(1)
            .find();

        if (queryResult.items.length > 0) {
            const existingContact = queryResult.items[0];
            console.log(`[CRM] Found existing contact: ${existingContact._id}`);
            return {
                contactId: existingContact._id,
                isNew: false,
                contact: existingContact
            };
        }

        // Create new contact
        console.log(`[CRM] No existing contact found. Creating new contact...`);
        const contactInfo = {
            name: { 
                first: firstName, 
                last: lastName 
            },
            emails: [{ 
                email: email, 
                tag: "MAIN", 
                primary: true 
            }]
        };

        const { contact } = await elevate(contacts.createContact)(contactInfo);
        
        console.log(`[CRM] Created new contact with ID: ${contact._id}`);
        return {
            contactId: contact._id,
            isNew: true,
            contact: contact
        };

    } catch (error) {
        console.error("[CRM] Error in findOrCreateContact:", error);
        throw new Error(`Failed to find or create contact: ${error.message}`);
    }
}