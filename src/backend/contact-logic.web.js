// src/backend/contact-logic.web.js
// CRM Contact management logic

/**
 * TEMPORARY: Skip contact creation entirely
 * Focus on getting the core application flow working first
 */
export async function findOrCreateContact(email, firstName, lastName) {
    console.log(`📧 SKIP: Would create contact for ${email} but skipping for now`);
    
    // Return a fake contact object that matches the expected structure
    return {
        contact: {
            _id: `fake-contact-${Date.now()}`,
            primaryInfo: {
                email: email
            },
            info: {
                name: {
                    first: firstName || '',
                    last: lastName || ''
                }
            }
        },
        wasCreated: false // Set to false so we don't try to send emails
    };
}   