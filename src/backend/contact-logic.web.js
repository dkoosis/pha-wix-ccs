// src/backend/contact-logic.web.js
// CRM Contact management logic

import { contacts } from 'wix-crm-backend';

/**
 * Finds a contact by email or creates a new one using the "query-then-create" pattern.
 * 
 * NOTE: Unlike wix-members-backend, the CRM API doesn't prevent duplicate contacts,
 * so we must query first to avoid creating duplicates. This is NOT a race condition
 * risk because duplicate contacts are allowed by the system - we're just choosing
 * to deduplicate by email as a business rule.
 *
 * @param {string} email - The email address to search for or use when creating
 * @param {string} firstName - First name for new contacts (optional)
 * @param {string} lastName - Last name for new contacts (optional)
 * @returns {Promise<{contact: object, wasCreated: boolean}>}
 *          - contact: The full Wix CRM contact object
 *          - wasCreated: true if a new contact was created, false if existing was found
 */
export async function findOrCreateContact(email, firstName, lastName) {
    // Input validation - email is our unique identifier for deduplication
    if (!email) {
        throw new Error("Email is required to find or create a contact.");
    }

    // IMPORTANT: suppressAuth allows backend code to access all contacts,
    // not just those created by the current user. This is necessary for
    // proper deduplication across all contacts in the system.
    const options = { suppressAuth: true };

    try {
        // Step 1: Query for existing contact by email
        console.log(`Querying for existing contact with email: ${email}`);
        
        // GOTCHA: The email field path is "info.emails.email" not "email" or "info.email"
        // This searches through the emails array for any email that matches
        const existingContacts = await contacts.queryContacts()
            .eq("info.emails.email", email)
            .limit(1) // Performance optimization - we only need to know if one exists
            .find(options);

        // Step 2: Return existing contact if found
        if (existingContacts.items.length > 0) {
            const existingContact = existingContacts.items[0];
            console.log(`Found existing contact: ${existingContact._id}`);
            
            // Return the existing contact with wasCreated=false
            return {
                contact: existingContact,
                wasCreated: false
            };
        }

        // Step 3: Create new contact if none exists
        console.log(`No existing contact found. Creating new contact for: ${email}`);
        
        // Contact structure expected by Wix CRM:
        // - name: object with 'first' and 'last' properties
        // - emails: array of email objects (even for a single email)
        const contactInfo = {
            name: { 
                first: firstName || '', // Default to empty string if not provided
                last: lastName || '' 
            },
            emails: [{ 
                email: email,
                tag: "MAIN",      // Standard Wix tag for primary email
                primary: true     // Mark as the primary email address
            }]
            // You can add more fields here like:
            // phones: [{ phone: "+1234567890", tag: "MOBILE", primary: true }]
            // addresses: [{ city: "New York", tag: "HOME" }]
        };

        // createContact returns an object with a 'contact' property containing the new contact
        const createResult = await contacts.createContact(contactInfo, options);
        
        console.log(`Created new contact with ID: ${createResult.contact._id}`);
        
        // Return structure matches the 'found' case for consistency
        return {
            contact: createResult.contact,
            wasCreated: true
        };
        
    } catch (error) {
        // Log the full error for debugging
        console.error("Error in findOrCreateContact:", error);
        
        // Re-throw with a more descriptive message
        // This allows http-functions.js to handle the error appropriately
        throw new Error(`Failed to find or create contact: ${error.message}`);
    }
}