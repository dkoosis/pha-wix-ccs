// Add this import at the top of your file with the other imports
import { authentication } from '@wix/members';

/**
 * Finds a site member using their contact ID. If the member does not exist,
 * it uses the Wix REST API to create a new member and sends a password setup email.
 */
async function findMemberByContactId(contactId, email) {
    const WIX_CREATE_MEMBER_API_URL = "https://www.wixapis.com/members/v1/members";

    let memberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
        .eq("contactId", contactId)
        .find();
    
    if (memberQuery.items.length > 0) {
        const member = memberQuery.items[0];
        console.log(`Found existing Member ID: ${member._id}`);
        return { memberId: member._id, memberData: member };
    } else {
        console.log(`Contact is not a member. Creating member for ${email} via REST API...`);
        const wixApiKey = await getSecret(WIX_REST_API_KEY_NAME);

        // Create member using the correct API structure
        const requestBody = {
            "member": {
                "loginEmail": email,
                "contactId": contactId
            }
        };

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': wixApiKey
            },
            body: JSON.stringify(requestBody)
        };

        const response = await fetch(WIX_CREATE_MEMBER_API_URL, fetchOptions);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create member via REST API: ${errorText}`);
        }
        
        const responseData = await response.json();
        const newMemberId = responseData.member.id;
        
        console.log(`Member created successfully with ID: ${newMemberId}`);
        
        // Send password setup email using the SDK
        try {
            await authentication.sendSetPasswordEmail(email, {
                hideIgnoreMessage: false
            });
            console.log(`Password setup email sent to ${email}`);
        } catch (emailError) {
            console.warn(`Member created but failed to send password email: ${emailError.message}`);
            // Don't throw here - member was created successfully
        }
        
        // Find the new member record in your database
        const newMemberQuery = await elevate(wixData.query)(MEMBERS_COLLECTION_ID)
            .eq("contactId", contactId)
            .find();
        
        if (newMemberQuery.items.length > 0) {
            const newMember = newMemberQuery.items[0];
            console.log(`Found new Member record with ID: ${newMember._id}`);
            return { memberId: newMember._id, memberData: newMember };
        } else {
            throw new Error(`Failed to find member record for ${email} after creation.`);
        }
    }
}