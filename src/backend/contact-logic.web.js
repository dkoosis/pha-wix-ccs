// src/backend/contact-logic.web.js
// CRM Contact management logic

// TEST IMPORTS - Add diagnostic logging to see what's failing
console.log('🧪 Starting contact-logic.web.js module load...');

// Test import 1
try {
    console.log('🧪 Testing @wix/crm import...');
    var { contacts } = require('@wix/crm');
    console.log('✅ @wix/crm import successful');
} catch (error) {
    console.log('❌ @wix/crm import failed:', error.message);
    // Fallback - try old import
    try {
        var { contacts } = require('wix-crm-backend');
        console.log('✅ Fallback to wix-crm-backend successful');
    } catch (fallbackError) {
        console.log('❌ wix-crm-backend fallback also failed:', fallbackError.message);
    }
}

// Test import 2
try {
    console.log('🧪 Testing @wix/essentials import...');
    var { auth } = require('@wix/essentials');
    console.log('✅ @wix/essentials import successful');
} catch (error) {
    console.log('❌ @wix/essentials import failed:', error.message);
    // Fallback - try old import
    try {
        var { elevate } = require('wix-auth');
        console.log('✅ Fallback to wix-auth successful');
    } catch (fallbackError) {
        console.log('❌ wix-auth fallback also failed:', fallbackError.message);
    }
}

console.log('🧪 Module imports complete');

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

    // TEMPORARY: Just throw an error until we get the imports working
    throw new Error("Contact creation temporarily disabled until imports are fixed");
}

/**
 * TEMPORARY TEST FUNCTION - Remove after confirming it works
 * Simple test to verify CRM contacts API pattern
 */
export async function testCreateContactOnly(email, firstName, lastName) {
    console.log(`🧪 TEST: Attempting to create contact for ${email}`);
    
    // Check what imports are available
    if (typeof contacts === 'undefined') {
        throw new Error("🧪 TEST FAILED: contacts API not available");
    }
    
    if (typeof auth === 'undefined' && typeof elevate === 'undefined') {
        throw new Error("🧪 TEST FAILED: neither auth.elevate nor elevate available");
    }
    
    try {
        const contactInfo = {
            name: {
                first: firstName || 'Test',
                last: lastName || 'User'
            },
            emails: {
                items: [{
                    email: email,
                    primary: true
                }]
            }
        };

        console.log(`🧪 TEST: Contact info prepared, attempting API call...`);

        // Try the new pattern first
        if (typeof auth !== 'undefined' && auth.elevate) {
            console.log(`🧪 TEST: Using auth.elevate pattern`);
            const elevatedCreateContact = auth.elevate(contacts.createContact);
            const result = await elevatedCreateContact(contactInfo);
            
            console.log(`🧪 TEST SUCCESS: Contact created with ID ${result.contact._id}`);
            return {
                contact: result.contact,
                wasCreated: true
            };
        }
        
        // Try the old pattern
        if (typeof elevate !== 'undefined') {
            console.log(`🧪 TEST: Using elevate pattern`);
            const result = await elevate(contacts.createContact)(contactInfo);
            
            console.log(`🧪 TEST SUCCESS: Contact created with ID ${result._id}`);
            return {
                contact: result,
                wasCreated: true
            };
        }
        
        // Try direct call as last resort
        console.log(`🧪 TEST: Trying direct API call`);
        const result = await contacts.createContact(contactInfo);
        
        console.log(`🧪 TEST SUCCESS: Contact created with ID ${result.contact._id}`);
        return {
            contact: result.contact,
            wasCreated: true
        };
        
    } catch (error) {
        console.error("🧪 TEST FAILED:", error);
        throw error;
    }
}