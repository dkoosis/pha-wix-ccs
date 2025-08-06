// Add this to backend/check-contacts.web.js
import { Permissions, webMethod } from "wix-web-module";
import { contacts } from 'wix-crm-backend';

/**
 * Check both email contacts to see what's different
 */
export const checkFiringContacts = webMethod(
  Permissions.Admin,
  async () => {
    const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c";
    const TEST_RECIPIENT = "93244038-75ea-4a7b-88c6-e79d78c890a8"; // Slack - WORKING
    
    const results = {
      printer: null,
      slack: null
    };
    
    try {
      // Check printer contact
      console.log("Checking printer contact:", CCS_RECEIPT_PRINTER);
      const printer = await contacts.getContact(CCS_RECEIPT_PRINTER);
      results.printer = {
        exists: true,
        contactId: printer._id,
        email: printer.primaryInfo?.email || "NO EMAIL",
        firstName: printer.primaryInfo?.firstName || "",
        lastName: printer.primaryInfo?.lastName || "",
        labelKeys: printer.labelKeys || [],
        createdDate: printer._createdDate,
        updatedDate: printer._updatedDate
      };
      console.log("Printer contact found:", results.printer);
    } catch (error) {
      results.printer = {
        exists: false,
        error: error.message
      };
      console.error("Printer contact error:", error);
    }
    
    try {
      // Check Slack contact (this one works)
      console.log("Checking Slack contact:", TEST_RECIPIENT);
      const slack = await contacts.getContact(TEST_RECIPIENT);
      results.slack = {
        exists: true,
        contactId: slack._id,
        email: slack.primaryInfo?.email || "NO EMAIL",
        firstName: slack.primaryInfo?.firstName || "",
        lastName: slack.primaryInfo?.lastName || "",
        labelKeys: slack.labelKeys || [],
        createdDate: slack._createdDate,
        updatedDate: slack._updatedDate
      };
      console.log("Slack contact found:", results.slack);
    } catch (error) {
      results.slack = {
        exists: false,
        error: error.message
      };
      console.error("Slack contact error:", error);
    }
    
    // Compare the two
    console.log("\n=== CONTACT COMPARISON ===");
    console.log("SLACK (WORKING):", results.slack);
    console.log("PRINTER (NOT WORKING):", results.printer);
    
    if (results.printer.exists && results.slack.exists) {
      console.log("\n=== KEY DIFFERENCES ===");
      if (results.printer.email === "NO EMAIL") {
        console.log("❌ PRINTER HAS NO EMAIL ADDRESS!");
      }
      if (results.printer.email !== results.slack.email && results.printer.email !== "NO EMAIL") {
        console.log("✓ Both have different email addresses (expected)");
      }
      console.log("Printer email:", results.printer.email);
      console.log("Slack email:", results.slack.email);
    }
    
    return results;
  }
);

/**
 * Update the printer contact's email address
 */
export const updatePrinterEmail = webMethod(
  Permissions.Admin,
  async (newEmail) => {
    const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c";
    
    try {
      console.log(`Updating printer contact email to: ${newEmail}`);
      
      const updatedContact = await contacts.updateContact(CCS_RECEIPT_PRINTER, {
        primaryInfo: {
          email: newEmail
        }
      });
      
      console.log("✓ Printer contact email updated successfully");
      return {
        success: true,
        contactId: updatedContact._id,
        newEmail: updatedContact.primaryInfo.email
      };
      
    } catch (error) {
      console.error("Failed to update printer contact:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
);

/**
 * Search for contacts by email to find the correct printer contact
 */
export const findContactByEmail = webMethod(
  Permissions.Admin,
  async (email) => {
    try {
      console.log(`Searching for contact with email: ${email}`);
      
      const queryResults = await contacts.queryContacts()
        .eq("primaryInfo.email", email)
        .find();
      
      if (queryResults.items.length === 0) {
        return {
          found: false,
          message: `No contact found with email: ${email}`
        };
      }
      
      const contact = queryResults.items[0];
      return {
        found: true,
        contactId: contact._id,
        email: contact.primaryInfo.email,
        name: `${contact.primaryInfo.firstName || ""} ${contact.primaryInfo.lastName || ""}`.trim(),
        message: `Found contact: ${contact._id}`
      };
      
    } catch (error) {
      console.error("Search failed:", error);
      return {
        found: false,
        error: error.message
      };
    }
  }
);
