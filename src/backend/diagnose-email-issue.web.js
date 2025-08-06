// Add this to backend/diagnose-email-issue.web.js
import { Permissions, webMethod } from "wix-web-module";
import { contacts } from 'wix-crm-backend';
import { triggeredEmails } from "wix-crm-backend";

/**
 * Test sending the exact same email to both contacts individually
 */
export const testIndividualSends = webMethod(
  Permissions.Admin,
  async () => {
    const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c";
    const TEST_RECIPIENT = "93244038-75ea-4a7b-88c6-e79d78c890a8"; // Slack
    const EMAIL_TEMPLATE_ID = "Upm0b8C";
    
    const results = {
      printer: null,
      slack: null
    };
    
    // Test variables
    const testVars = {
      emailSubject: "TEST - Diagnostic Email",
      itemDescription: "This is a test firing slip<br><br>Testing email delivery",
      customerName: "Test Customer",
      customerEmailAddress: "test@example.com",
      customerPhoneNumber: "555-1234",
      orderNumber: "TEST-001",
      orderDate: new Date().toLocaleDateString(),
      orderTotalAmount: "$100.00",
      itemName: "Test Firing Service",
      itemQuantity: "1",
      itemPrice: "$100.00",
      emailAddress: "test@example.com",
      receiptNumber: "",
      tax: "$0.00",
      orderSubtotal: "$100.00",
      paymentDate: new Date().toLocaleDateString(),
      paymentCard: "",
      paymentTotal: "$100.00",
      companyName: ""
    };
    
    // Test printer first
    console.log("[DIAGNOSE] Testing PRINTER contact individually...");
    try {
      console.log("[DIAGNOSE] Sending to printer:", CCS_RECEIPT_PRINTER);
      const printerResult = await triggeredEmails.emailContact(
        EMAIL_TEMPLATE_ID,
        CCS_RECEIPT_PRINTER,
        { variables: testVars }
      );
      console.log("[DIAGNOSE] Printer result:", JSON.stringify(printerResult || 'undefined'));
      results.printer = {
        success: true,
        result: printerResult
      };
    } catch (error) {
      console.error("[DIAGNOSE] Printer failed:", error.message);
      results.printer = {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
    }
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test Slack
    console.log("[DIAGNOSE] Testing SLACK contact individually...");
    try {
      console.log("[DIAGNOSE] Sending to Slack:", TEST_RECIPIENT);
      const slackResult = await triggeredEmails.emailContact(
        EMAIL_TEMPLATE_ID,
        TEST_RECIPIENT,
        { variables: testVars }
      );
      console.log("[DIAGNOSE] Slack result:", JSON.stringify(slackResult || 'undefined'));
      results.slack = {
        success: true,
        result: slackResult
      };
    } catch (error) {
      console.error("[DIAGNOSE] Slack failed:", error.message);
      results.slack = {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
    }
    
    console.log("[DIAGNOSE] ===== RESULTS =====");
    console.log("[DIAGNOSE] Printer:", results.printer);
    console.log("[DIAGNOSE] Slack:", results.slack);
    
    return results;
  }
);

/**
 * Compare contact properties in detail
 */
export const compareContactProperties = webMethod(
  Permissions.Admin,
  async () => {
    const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c";
    const TEST_RECIPIENT = "93244038-75ea-4a7b-88c6-e79d78c890a8";
    
    try {
      const [printer, slack] = await Promise.all([
        contacts.getContact(CCS_RECEIPT_PRINTER),
        contacts.getContact(TEST_RECIPIENT)
      ]);
      
      console.log("[DIAGNOSE] ===== FULL CONTACT COMPARISON =====");
      
      // Compare all properties
      const comparison = {
        printer: {
          id: printer._id,
          email: printer.primaryInfo?.email,
          emailStatus: printer.primaryInfo?.emailStatus,
          emailDeliverability: printer.primaryInfo?.emailDeliverability,
          subscriptions: printer.primaryInfo?.subscriptions,
          contactSource: printer.source?.sourceType,
          createdDate: printer._createdDate,
          updatedDate: printer._updatedDate,
          labelKeys: printer.labelKeys,
          extendedFields: printer.extendedFields
        },
        slack: {
          id: slack._id,
          email: slack.primaryInfo?.email,
          emailStatus: slack.primaryInfo?.emailStatus,
          emailDeliverability: slack.primaryInfo?.emailDeliverability,
          subscriptions: slack.primaryInfo?.subscriptions,
          contactSource: slack.source?.sourceType,
          createdDate: slack._createdDate,
          updatedDate: slack._updatedDate,
          labelKeys: slack.labelKeys,
          extendedFields: slack.extendedFields
        }
      };
      
      console.log("[DIAGNOSE] Printer contact:", JSON.stringify(comparison.printer, null, 2));
      console.log("[DIAGNOSE] Slack contact:", JSON.stringify(comparison.slack, null, 2));
      
      // Check for key differences
      const differences = [];
      
      if (comparison.printer.emailStatus !== comparison.slack.emailStatus) {
        differences.push(`Email Status: Printer=${comparison.printer.emailStatus}, Slack=${comparison.slack.emailStatus}`);
      }
      
      if (comparison.printer.emailDeliverability !== comparison.slack.emailDeliverability) {
        differences.push(`Email Deliverability: Printer=${comparison.printer.emailDeliverability}, Slack=${comparison.slack.emailDeliverability}`);
      }
      
      if (JSON.stringify(comparison.printer.subscriptions) !== JSON.stringify(comparison.slack.subscriptions)) {
        differences.push(`Subscriptions differ`);
      }
      
      console.log("[DIAGNOSE] Key differences:", differences.length > 0 ? differences : ["None found"]);
      
      return {
        comparison,
        differences
      };
      
    } catch (error) {
      console.error("[DIAGNOSE] Comparison failed:", error);
      return { error: error.message };
    }
  }
);
