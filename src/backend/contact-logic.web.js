// src/backend/contact-logic.web.js
// CRM Contact management logic

import { contacts } from 'wix-crm-backend';
//import { suppressAuth } from 'wix-auth';

/**
 * Finds a contact by email or creates a new one.
 * @param {string} email
 * @param {string} firstName
 * @param {string} lastName
 * @returns {Promise<{contact: object, wasCreated: boolean}>}
 */
export async function findOrCreateContact(email, firstName, lastName) {
    if (!email) {
        throw new Error("Email is required to find or create a contact.");
    }

    // Velo Best Practice: Use { suppressAuth: true } for all backend data operations
    // to ensure they run with admin privileges. This is the correct replacement
    // for the 'elevate()' pattern.
    const options = { suppressAuth: true };

    // First, try to find an existing contact with the provided email.
    const existingContacts = await contacts.queryContacts()
        .eq("info.emails.email", email)
        .limit(1)
        .find(options); // Apply the options here

    if (existingContacts.items.length > 0) {
        // If a contact is found, return it.
        return {
            contact: existingContacts.items[0],
            wasCreated: false
        };
    } else {
        // If no contact is found, create a new one.
        const contactInfo = {
            name: { first: firstName, last: lastName },
            emails: [{ email: email, tag: "MAIN" }]
        };

        const newContact = await contacts.createContact(contactInfo, options); // Apply the options here as well

        return {
            contact: newContact,
            wasCreated: true
        };
    }
}