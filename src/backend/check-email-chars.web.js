// Add this to backend/check-email-chars.web.js
import { Permissions, webMethod } from "wix-web-module";
import { contacts } from 'wix-crm-backend';

/**
 * Check the exact characters in both email addresses
 */
export const checkEmailCharacters = webMethod(
  Permissions.Admin,
  async () => {
    const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c";
    const TEST_RECIPIENT = "93244038-75ea-4a7b-88c6-e79d78c890a8";
    
    try {
      // Get both contacts
      const printer = await contacts.getContact(CCS_RECEIPT_PRINTER);
      const slack = await contacts.getContact(TEST_RECIPIENT);
      
      const printerEmail = printer.primaryInfo?.email || "NO EMAIL";
      const slackEmail = slack.primaryInfo?.email || "NO EMAIL";
      
      console.log("\n=== EMAIL CHARACTER ANALYSIS ===");
      
      // Analyze printer email
      console.log("\nPRINTER EMAIL:", printerEmail);
      console.log("Length:", printerEmail.length);
      console.log("Character codes:");
      for (let i = 0; i < printerEmail.length; i++) {
        const char = printerEmail[i];
        const code = printerEmail.charCodeAt(i);
        if (char === '-' || char === '–' || char === '—' || code === 45 || code === 8211 || code === 8212) {
          console.log(`  Position ${i}: '${char}' = Code ${code} ${code === 45 ? '✓ (correct hyphen)' : '❌ (WRONG DASH!)'}`);
        }
      }
      
      // Check for common issues
      const hasRegularHyphen = printerEmail.includes('-'); // ASCII 45
      const hasEnDash = printerEmail.includes('–'); // Unicode 8211
      const hasEmDash = printerEmail.includes('—'); // Unicode 8212
      
      console.log("\nDash check:");
      console.log("  Regular hyphen (-):", hasRegularHyphen);
      console.log("  En-dash (–):", hasEnDash);
      console.log("  Em-dash (—):", hasEmDash);
      
      // Show the correct email
      const correctEmail = "ceramics-receipt-printer@powerhousearts.org";
      console.log("\n=== COMPARISON ===");
      console.log("Current email:", printerEmail);
      console.log("Correct email:", correctEmail);
      console.log("Are they identical?", printerEmail === correctEmail);
      
      // Character-by-character comparison
      if (printerEmail !== correctEmail && printerEmail !== "NO EMAIL") {
        console.log("\nCharacter differences:");
        for (let i = 0; i < Math.max(printerEmail.length, correctEmail.length); i++) {
          if (printerEmail[i] !== correctEmail[i]) {
            console.log(`  Position ${i}: '${printerEmail[i]}' (${printerEmail.charCodeAt(i)}) vs '${correctEmail[i]}' (${correctEmail.charCodeAt(i)})`);
          }
        }
      }
      
      return {
        printerEmail,
        printerEmailLength: printerEmail.length,
        hasCorrectHyphen: hasRegularHyphen && !hasEnDash && !hasEmDash,
        isCorrect: printerEmail === correctEmail,
        slackEmail,
        slackWorks: true
      };
      
    } catch (error) {
      console.error("Error checking emails:", error);
      return { error: error.message };
    }
  }
);

/**
 * Fix the printer email with the correct hyphen
 */
export const fixPrinterEmail = webMethod(
  Permissions.Admin,
  async () => {
    const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c";
    const CORRECT_EMAIL = "ceramics-receipt-printer@powerhousearts.org"; // Using regular hyphen
    
    try {
      console.log("Updating printer contact with correct email (regular hyphen)...");
      
      const updatedContact = await contacts.updateContact(CCS_RECEIPT_PRINTER, {
        primaryInfo: {
          email: CORRECT_EMAIL
        }
      });
      
      console.log("✓ Email updated to:", updatedContact.primaryInfo.email);
      
      // Verify the update
      const verification = await contacts.getContact(CCS_RECEIPT_PRINTER);
      const newEmail = verification.primaryInfo.email;
      
      console.log("\nVerification:");
      console.log("  New email:", newEmail);
      console.log("  Length:", newEmail.length);
      console.log("  Matches correct email:", newEmail === CORRECT_EMAIL);
      
      return {
        success: true,
        oldEmail: updatedContact.primaryInfo.email,
        newEmail: CORRECT_EMAIL,
        verified: newEmail === CORRECT_EMAIL
      };
      
    } catch (error) {
      console.error("Failed to fix email:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
);
