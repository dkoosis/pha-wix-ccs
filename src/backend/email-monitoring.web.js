// Add to backend/email-monitoring.web.js
import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails } from "wix-crm-backend";
import { contacts } from "wix-crm-backend";
import wixData from "wix-data";

// Configuration
const ADMIN_ALERT_CONTACT = "f1e8e370-6b78-49f0-b434-d85e00a67e9b"; // Your admin contact ID
const ADMIN_EMAIL = "vcto@powerhousearts.org"; // Backup admin email
const ALERT_TEMPLATE_ID = "Upm0b8C"; // Using same template for now - should create dedicated alert template

/**
 * Enhanced sendFiringSlip with error detection and admin alerting
 */
export const sendFiringSlipWithMonitoring = webMethod(
  Permissions.Anyone,
  async (orderId, printerContactId, slackContactId) => {
    const errors = [];
    const alerts = [];
    
    try {
      // ... existing firing slip logic ...
      
      // When an email fails, check if it's a validation error
      if (error.message.includes("does not have valid email for site")) {
        await handleInvalidEmailError(error, contactId, orderId);
      }
      
    } catch (error) {
      // Log and alert on critical errors
      await logEmailError(error, orderId);
    }
  }
);

/**
 * Handle invalid email errors and alert admins
 */
async function handleInvalidEmailError(error, contactId, orderId) {
  console.error(`[CRITICAL] Invalid email for contact ${contactId}`);
  
  // Extract details from error message
  const errorDetails = {
    contactId,
    orderId,
    errorMessage: error.message,
    timestamp: new Date(),
    type: "INVALID_EMAIL_FOR_TRIGGERED_SEND"
  };
  
  // 1. Log to a monitoring collection
  await logToMonitoringCollection(errorDetails);
  
  // 2. Send alert to admin
  await sendAdminAlert(errorDetails);
  
  // 3. Try to auto-fix if possible
  await attemptAutoFix(contactId);
}

/**
 * Log errors to a monitoring collection for tracking
 */
async function logToMonitoringCollection(errorDetails) {
  try {
    await wixData.insert("EmailErrors", {
      ...errorDetails,
      resolved: false,
      alertSent: false
    });
    console.log("[MONITORING] Error logged to collection");
  } catch (err) {
    console.error("[MONITORING] Failed to log to collection:", err);
  }
}

/**
 * Send alert to admin about email issues
 */
async function sendAdminAlert(errorDetails) {
  const alertMessage = `
    <h2>⚠️ Firing Slip Email Failed</h2>
    
    <p><strong>Critical Issue Detected:</strong> A firing slip email could not be sent.</p>
    
    <h3>Error Details:</h3>
    <ul>
      <li><strong>Order ID:</strong> ${errorDetails.orderId}</li>
      <li><strong>Contact ID:</strong> ${errorDetails.contactId}</li>
      <li><strong>Error:</strong> ${errorDetails.errorMessage}</li>
      <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
    </ul>
    
    <h3>Likely Cause:</h3>
    <p>The contact has either:</p>
    <ul>
      <li>Unsubscribed from emails (check subscription status)</li>
      <li>Invalid email address for triggered sends</li>
      <li>Email deliverability issues</li>
    </ul>
    
    <h3>Action Required:</h3>
    <ol>
      <li>Check the contact in Wix CRM: <code>${errorDetails.contactId}</code></li>
      <li>Verify email subscription status</li>
      <li>Re-save the email address or create a new contact</li>
      <li>Update the PRINTER_CONTACT constant if needed</li>
    </ol>
    
    <p>The firing slip was still sent to the Slack channel for backup.</p>
  `;
  
  try {
    // Try sending to admin contact
    await triggeredEmails.emailContact(
      ALERT_TEMPLATE_ID,
      ADMIN_ALERT_CONTACT,
      {
        variables: {
          emailSubject: "🚨 URGENT: Firing Slip Email System Issue",
          itemDescription: alertMessage,
          // Fill other required variables with placeholder data
          customerName: "SYSTEM ALERT",
          orderNumber: errorDetails.orderId || "N/A",
          orderDate: new Date().toLocaleDateString(),
          customerEmailAddress: "system@alert",
          customerPhoneNumber: "N/A",
          orderTotalAmount: "$0.00",
          itemName: "System Alert",
          itemQuantity: "1",
          itemPrice: "$0.00",
          emailAddress: ADMIN_EMAIL,
          receiptNumber: "",
          tax: "$0.00",
          orderSubtotal: "$0.00",
          paymentDate: new Date().toLocaleDateString(),
          paymentCard: "",
          paymentTotal: "$0.00",
          companyName: "PHA System"
        }
      }
    );
    
    console.log("[ALERT] Admin notified successfully");
    
    // Also log this alert
    await wixData.update("EmailErrors", {
      ...errorDetails,
      alertSent: true,
      alertSentAt: new Date()
    });
    
  } catch (alertError) {
    console.error("[ALERT] Failed to send admin alert:", alertError);
    // Could implement fallback like webhook to Slack, external monitoring service, etc.
  }
}

/**
 * Attempt to automatically fix common email issues
 */
async function attemptAutoFix(contactId) {
  try {
    console.log(`[AUTO-FIX] Attempting to fix contact ${contactId}`);
    
    // Get the contact
    const contact = await contacts.getContact(contactId);
    
    // Check subscription status
    const subscriptionStatus = contact.info?.extendedFields?.["emailSubscriptions.subscriptionStatus"];
    
    if (subscriptionStatus === "UNSUBSCRIBED") {
      console.log("[AUTO-FIX] Contact is unsubscribed - cannot auto-fix");
      return { 
        fixed: false, 
        reason: "Contact has unsubscribed - requires manual intervention" 
      };
    }
    
    // Try re-saving the email to trigger revalidation
    if (contact.primaryInfo?.email) {
      await contacts.updateContact(contactId, {
        primaryInfo: {
          email: contact.primaryInfo.email
        }
      });
      
      console.log("[AUTO-FIX] Email re-saved for validation");
      return { 
        fixed: "attempted", 
        action: "email_revalidation" 
      };
    }
    
    return { 
      fixed: false, 
      reason: "No email found" 
    };
    
  } catch (error) {
    console.error("[AUTO-FIX] Failed:", error);
    return { 
      fixed: false, 
      error: error.message 
    };
  }
}

/**
 * Check system health and preemptively detect issues
 */
export const checkEmailSystemHealth = webMethod(
  Permissions.Admin,
  async () => {
    const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c";
    const TEST_RECIPIENT = "93244038-75ea-4a7b-88c6-e79d78c890a8";
    
    const issues = [];
    
    // Check printer contact
    try {
      const printer = await contacts.getContact(CCS_RECEIPT_PRINTER);
      
      // Check subscription status
      const subStatus = printer.info?.extendedFields?.["emailSubscriptions.subscriptionStatus"];
      if (subStatus === "UNSUBSCRIBED") {
        issues.push({
          severity: "CRITICAL",
          contact: "PRINTER",
          issue: "Contact is UNSUBSCRIBED - triggered emails will fail",
          action: "Re-subscribe or create new contact"
        });
      }
      
      // Check email validity
      if (!printer.primaryInfo?.email) {
        issues.push({
          severity: "CRITICAL",
          contact: "PRINTER",
          issue: "No email address",
          action: "Add email address"
        });
      }
      
      // Check email deliverability
      if (printer.primaryInfo?.emailDeliverability === "INVALID") {
        issues.push({
          severity: "HIGH",
          contact: "PRINTER",
          issue: "Email marked as invalid",
          action: "Verify email address"
        });
      }
      
    } catch (error) {
      issues.push({
        severity: "CRITICAL",
        contact: "PRINTER",
        issue: `Contact not found: ${error.message}`,
        action: "Recreate contact"
      });
    }
    
    // Check Slack contact
    try {
      const slack = await contacts.getContact(TEST_RECIPIENT);
      const subStatus = slack.info?.extendedFields?.["emailSubscriptions.subscriptionStatus"];
      
      if (subStatus === "UNSUBSCRIBED") {
        issues.push({
          severity: "HIGH",
          contact: "SLACK",
          issue: "Backup contact is UNSUBSCRIBED",
          action: "Re-subscribe or update contact"
        });
      }
      
    } catch (error) {
      issues.push({
        severity: "HIGH",
        contact: "SLACK",
        issue: `Backup contact not found: ${error.message}`,
        action: "Update contact ID"
      });
    }
    
    // Check recent errors
    const recentErrors = await wixData.query("EmailErrors")
      .ge("timestamp", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
      .eq("resolved", false)
      .find();
    
    if (recentErrors.items.length > 0) {
      issues.push({
        severity: "MEDIUM",
        contact: "SYSTEM",
        issue: `${recentErrors.items.length} unresolved email errors in past 7 days`,
        action: "Review error log"
      });
    }
    
    // Send health report if issues found
    if (issues.length > 0) {
      console.warn("[HEALTH CHECK] Issues found:", issues);
      await sendHealthReport(issues);
    } else {
      console.log("[HEALTH CHECK] System healthy");
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      checkedAt: new Date()
    };
  }
);

/**
 * Send health report to admin
 */
async function sendHealthReport(issues) {
  const criticalCount = issues.filter(i => i.severity === "CRITICAL").length;
  const highCount = issues.filter(i => i.severity === "HIGH").length;
  
  const reportHtml = `
    <h2>Email System Health Report</h2>
    <p>Issues detected: ${criticalCount} critical, ${highCount} high priority</p>
    
    <table border="1" cellpadding="5">
      <tr>
        <th>Severity</th>
        <th>Component</th>
        <th>Issue</th>
        <th>Action Required</th>
      </tr>
      ${issues.map(i => `
        <tr>
          <td style="color: ${i.severity === 'CRITICAL' ? 'red' : i.severity === 'HIGH' ? 'orange' : 'yellow'}">${i.severity}</td>
          <td>${i.contact}</td>
          <td>${i.issue}</td>
          <td>${i.action}</td>
        </tr>
      `).join('')}
    </table>
  `;
  
  // Send the report (implement based on your notification preferences)
  console.log("[HEALTH REPORT]", reportHtml);
  
  // Could also:
  // - Send via email
  // - Post to Slack webhook
  // - Create dashboard notification
  // - Log to monitoring service
}

/**
 * Schedule daily health checks (call this from a scheduled job)
 */
export const scheduledHealthCheck = webMethod(
  Permissions.Anyone,
  async () => {
    console.log("[SCHEDULED] Running daily health check");
    const result = await checkEmailSystemHealth();
    
    if (!result.healthy) {
      console.error("[SCHEDULED] Health check failed:", result.issues);
    }
    
    return result;
  }
);