// The code on this page has been written or altered by Sami from the Wix Wiz team.
// Reach out via support@thewixwiz.com or thewixwiz.com/contact-us.
import { Permissions, webMethod } from "wix-web-module";
import wixData from "wix-data";
import { members } from "wix-members.v2";
import { authorization, authentication } from "wix-members-backend";
import { elevate } from "wix-auth";
import { triggeredEmails, contacts } from "wix-crm-backend";

const CCS_INVITEE = "4ecb331a-1566-4879-9112-65103b74dd70";

const elevatedCreateMember = elevate(members.createMember);

export const getApplications = webMethod(Permissions.Anyone, async (status) => {
  let query = wixData.query("StudioMembershipApplications");

  if (status !== "All") {
    query = query.eq("reviewStatus", status);
  }
  const results = await query.limit(100).find({ suppressAuth: true });

  return { success: true, data: results.items, count: results.items.length };
});

export const updateReviewDecision = webMethod(
  Permissions.Anyone,
  async (payload) => {
    try {
      // update the application
      const result = await wixData.save(
        "StudioMembershipApplications",
        payload,
        { suppressAuth: true }
      );
      //console.log("Application saved:", result._id);

      //Verify if member already exists
      let memberId, conatcId;
      let needsPasswordEmail = false;
      const verifyMemberResult = await verifyMemberDetails(payload.email);

      if (verifyMemberResult.success) {
        memberId = verifyMemberResult.member._id;
        //  console.log("Existing member found:", memberId);
      } else {
        // Create new member
        if (payload.reviewDecision === "Approved") {
          const createMemberResult = await createNewMember(payload);
          if (createMemberResult.success) {
            memberId = createMemberResult.member;
            //console.log("New member created:", memberId);
            needsPasswordEmail = true;
          }
        } else {
          const createNewContact = await appendOrCreateContactFromItemData(
            payload
          );
          if (createNewContact.success) {
            conatcId = createNewContact.contactId;
          }
        }
      }

      // If Approved → Assign role + send approval email
      if (memberId && payload.reviewDecision === "Approved") {
        await assignCSSRole(memberId);
        //console.log("Role assigned to member:", memberId);

        await triggeredEmails.emailMember("UsPZ9F5", memberId, {
          variables: { firstName: payload.firstName },
        });

        if (needsPasswordEmail) {
          const result = await authentication.sendSetPasswordEmail(
            payload.email
          );
        }
        console.log("Approval email sent");
      }

      //If Rejected → Send rejection email
      if (memberId && payload.reviewDecision === "Rejected") {
        await triggeredEmails.emailMember("UsPa8BU", memberId, {
          variables: { firstName: payload.firstName },
        });
        // console.log("Rejection email sent to Member");
      }
      if (conatcId && payload.reviewDecision === "Rejected") {
        await triggeredEmails.emailContact("UsPa8BU", conatcId, {
          variables: { firstName: payload.firstName },
        });
        // console.log("Rejection email sent to contact");
      }

      return {
        success: true,
        message: "Review decision updated successfully.",
        data: result,
      };
    } catch (error) {
      console.error("Error updating review decision:", error);

      return {
        success: false,
        error: "Failed to update review decision.",
        details: error.message || String(error),
      };
    }
  }
);

export const verifyMemberDetails = webMethod(
  Permissions.Anyone,
  async (memberEmail) => {
    try {
      const existingMembersResult = await members
        .queryMembers()
        .eq("loginEmail", memberEmail)
        .limit(1)
        .find();

      if (existingMembersResult.items.length > 0) {
        return {
          success: true,
          member: existingMembersResult.items[0],
        };
      } else {
        return {
          success: false,
          error: `Member with loginEmail '${memberEmail}' not found.`,
        };
      }
    } catch (error) {
      console.error("Error in verifyMemberDetails:", error);
      return {
        success: false,
        error: "An unexpected error occurred while verifying member details.",
        details: error.message || error,
      };
    }
  }
);

export const assignCSSRole = webMethod(Permissions.Anyone, async (memberId) => {
  const options = {
    suppressAuth: true,
  };

  try {
    await authorization.assignRole(CCS_INVITEE, memberId, options);
    //console.log("Role assigned to member:", memberId);

    return {
      success: true,
      message: "Role successfully assigned.",
    };
  } catch (error) {
    console.error("Error assigning role:", error);

    return {
      success: false,
      error: "Failed to assign role.",
      details: error.message || error,
    };
  }
});

export const createNewMember = webMethod(
  Permissions.Anyone,
  async (itemData) => {
    if (!itemData?.email) {
      return { success: false, error: "Email is required to create a member." };
    }

    const mappedMember = mapItemToMember(itemData);

    try {
      const result = await elevatedCreateMember(mappedMember);
      //console.log("Member created:", result?._id);

      return {
        success: true,
        member: result._id,
      };
    } catch (error) {
      console.error("Error creating member:", error);
      return {
        success: false,
        error: "Failed to create member.",
        details: error.message || error,
      };
    }
  }
);

function mapItemToMember(item) {
  return {
    member: {
      loginEmail: item.email,
      privacyStatus: "PRIVATE",
      contact: {
        firstName: item.firstName,
        lastName: item.lastName,
        email: item.email,
        phone: item.phoneNumber,
        phones: [item.phoneNumber],
        emails: [item.email],
        addresses: [
          {
            addressLine1: item.street || "",
            city: item.city || "",
            subdivision: item.state || "",
            postalCode: item.zipCode || "",
            country: "US",
          },
        ],
      },
      profile: {
        nickname: `${item.firstName} ${item.lastName}`,
        title: item.title || "",
      },
    },
  };
}

export const appendOrCreateContactFromItemData = webMethod(
  Permissions.Anyone,
  async (item) => {
    if (!item?.email || !item?.firstName) {
      return {
        success: false,
        error:
          "Missing required fields: 'email' and 'firstName' are mandatory.",
      };
    }

    const contactInfo = {
      name: {
        first: item.firstName,
        last: item.lastName || "",
      },
      emails: [
        {
          email: item.email,
        },
      ],
      phones: item.phoneNumber
        ? [
            {
              tag: "MOBILE",
              countryCode: "US", // or detect from number
              phone: item.phoneNumber,
              primary: true,
            },
          ]
        : [],
    };

    try {
      const resolvedContact = await contacts.appendOrCreateContact(contactInfo);

      console.log("Contact created or updated:", resolvedContact.contactId);

      return {
        success: true,
        contactId: resolvedContact.contactId,
        identityType: resolvedContact.identityType,
      };
    } catch (error) {
      console.error("Error in appendOrCreateContact:", error);

      return {
        success: false,
        error: "Failed to create or update contact.",
        details: error.message || error,
      };
    }
  }
);
