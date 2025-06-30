// src/backend/contact-logic.web.js
// CRM Contact management logic

// FIXED: Use the correct new SDK import
import { contacts } from '@wix/crm';

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

    try {
        // Step 1: Query for existing contact by email
        console.log(`Querying for existing contact with email: ${email}`);
        
        // FIXED: Use correct SDK syntax - primaryInfo.email is confirmed correct
        const existingContacts = await contacts.queryContacts()
            .eq("primaryInfo.email", email)
            .limit(1)
            .find();

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
        
        // FIXED: Contact structure for new SDK
        const contactInfo = {
            name: { 
                first: firstName || '', 
                last: lastName || '' 
            },
            emails: {
                items: [{
                    email: email,
                    primary: true     // Mark as the primary email address
                    // tag will be automatically set by the API (defaults to "UNTAGGED")
                }]
            }
            // You can add more fields here like:
            // phones: { items: [{ phone: "+1234567890", primary: true }] }
            // addresses: { items: [{ address: { city: "New York" } }] }
        };

        // FIXED: Use new SDK createContact method
        const createResponse = await contacts.createContact(contactInfo);
        const newContact = createResponse.contact;
        
        console.log(`Created new contact with ID: ${newContact._id}`);
        
        // Return structure matches the 'found' case for consistency
        return {
            contact: newContact,
            wasCreated: true
        };
        
    } catch (error) {
        // Log the full error for debugging
        console.error("Error in findOrCreateContact:", error);
        
        // Re-throw with a more descriptive message
        throw new Error(`Failed to find or create contact: ${error.message}`);
    }
}