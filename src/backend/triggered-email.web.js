import { Permissions, webMethod } from "wix-web-module";
import { triggeredEmails } from "wix-crm-backend";
import { orders } from "wix-ecom-backend";

// Configuration
const FIRING_APP_ID = "97ed05e3-04ed-4095-af45-90587bfed9f0"; // App ID for firing service items
const CCS_RECEIPT_PRINTER = "087762eb-1ce1-4854-99ce-f30da6c8630c"; // Printer contact ID
const TEST_RECIPIENT = "93244038-75ea-4a7b-88c6-e79d78c890a8"; // Ceramics Slack Channel
const PRINTER_CONTACTS = [CCS_RECEIPT_PRINTER, TEST_RECIPIENT]; // Array of contacts to receive slips
const EMAIL_TEMPLATE_ID = "Upm0b8C";  // TODO: Create firing-specific template
const EMAIL_DELAY_MS = 3000; // 3 seconds between emails to avoid rate limiting

// Helper function for delays between emails
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends customer receipt to configured recipients
 * 
 * @param {string} orderId - The Wix order ID
 * @returns {Promise<void>}
 */
export const sendReceipt = webMethod(
  Permissions.Anyone,
  async (orderId) => {
    try {
      const order = await orders.getOrder(orderId);
      console.log("order", order);

      // Extract necessary fields
      const orderDate = new Date(order._createdDate).toLocaleDateString();
      const paymentDate = new Date(order.activities.find(a => a.type === "ORDER_PAID")?._createdDate || "").toLocaleDateString();
      const customerName = `${order.billingInfo.contactDetails.firstName} ${order.billingInfo.contactDetails.lastName}`;
      const customerEmail = order.buyerInfo.email;
      const customerPhone = order.billingInfo.contactDetails.phone;
      const receiptNumber = ""; // Receipt number not easily accessible from order object
      const companyName = ""; // Leave empty if not applicable
      const paymentCard = ""; // Leave empty if not retrievable
      const SITE_URL = "https://yourdomain.com"; // Replace with your actual site URL

      // Order pricing
      const subtotal = order.priceSummary.subtotal.formattedAmount;
      const tax = order.priceSummary.tax.formattedAmount;
      const total = order.priceSummary.total.formattedAmount;
      const paymentTotal = order.balanceSummary.paid.formattedAmount;

      // Build HTML table of items
      const html = `
            ${order.lineItems
              .map(
                (item,i) => `
               Item Name: ${item.productName.translated}
               Item Quantiy: ${item.quantity}
               Item Price: ${item.price.formattedAmount}
----------------------------------------------------------------------------------------------
            `
              )
              .join("")}
      `;
      
      // Trigger the email to CCS Receipt Printer
      await triggeredEmails.emailContact(
        EMAIL_TEMPLATE_ID,
        CCS_RECEIPT_PRINTER,
        {
          variables: {
            receiptNumber,
            orderNumber: order._id,
            orderDate,
            customerName,
            companyName,
            customerEmailAddress: customerEmail,
            customerPhoneNumber: customerPhone,
            orderSubtotal: subtotal,
            tax,
            orderTotalAmount: total,
            items: html,
            paymentDate,
            paymentCard,
            paymentTotal,
            SITE_URL
          }
        }
      );

      // Send to test recipient as well
      await triggeredEmails.emailContact(
        EMAIL_TEMPLATE_ID,
        TEST_RECIPIENT,
        {
          variables: {
            receiptNumber,
            orderNumber: order._id,
            orderDate,
            customerName,
            companyName,
            customerEmailAddress: customerEmail,
            customerPhoneNumber: customerPhone,
            orderSubtotal: subtotal,
            tax,
            orderTotalAmount: total,
            items: html,
            paymentDate,
            paymentCard,
            paymentTotal,
            SITE_URL
          }
        }
      );

    } catch (error) {
      console.error("Error sending email:", error);
    }
  }
);

/**
 * Sends individual firing slips to printer for each firing item in an order
 * Called automatically when an order is paid (from events.js)
 * 
 * @param {string} orderId - The Wix order ID
 * @returns {Promise<void>}
 */
export const sendFiringSlip = webMethod(
  Permissions.Anyone,
  async (orderId) => {
    console.log(`[FIRING-SLIP] ====== Starting sendFiringSlip for orderId: ${orderId} ======`);
    
    try {
      // Get the full order details from Wix
      console.log(`[FIRING-SLIP] Step 1: Fetching order ${orderId} from Wix...`);
      const order = await orders.getOrder(orderId);
      console.log(`[FIRING-SLIP] ✓ Order fetched: #${order.number}, Status: ${order.paymentStatus}, Total items: ${order.lineItems.length}`);

      // Filter for firing service items only - these have our custom APP_ID
      console.log(`[FIRING-SLIP] Step 2: Filtering for firing items with APP_ID: ${FIRING_APP_ID}`);
      const firingItems = order.lineItems.filter(item => {
        const appId = item.catalogReference?.appId;
        const isFiringItem = appId === FIRING_APP_ID;
        console.log(`[FIRING-SLIP]   - Item: "${item.productName.translated}" | AppID: ${appId || 'none'} | Is firing: ${isFiringItem}`);
        return isFiringItem;
      });

      console.log(`[FIRING-SLIP] ✓ Found ${firingItems.length} firing items`);

      // Skip if no firing items in this order
      if (firingItems.length === 0) {
        console.log(`[FIRING-SLIP] No firing items in order #${order.number} - Exiting normally`);
        return;
      }

      // Extract customer info for the firing slip header
      const customerName = `${order.billingInfo.contactDetails.firstName} ${order.billingInfo.contactDetails.lastName}`;
      const customerLastName = order.billingInfo.contactDetails.lastName || 'Customer';
      const orderNumber = order.number; // Friendly order number (not the GUID)
      const orderDate = new Date(order._createdDate).toLocaleDateString();
      
      console.log(`[FIRING-SLIP] Step 3: Customer info extracted`);
      console.log(`[FIRING-SLIP]   - Name: ${customerName}`);
      console.log(`[FIRING-SLIP]   - Order: #${orderNumber}`);
      console.log(`[FIRING-SLIP]   - Date: ${orderDate}`);
      console.log(`[FIRING-SLIP]   - Email: ${order.buyerInfo.email}`);
      
      // Send a separate email for each firing item
      let emailsSent = 0;
      let emailsFailed = 0;
      
      console.log(`[FIRING-SLIP] Step 4: Starting email send for ${firingItems.length} items to ${PRINTER_CONTACTS.length} contacts`);
      console.log(`[FIRING-SLIP]   - Template ID: ${EMAIL_TEMPLATE_ID}`);
      console.log(`[FIRING-SLIP]   - Contacts: ${PRINTER_CONTACTS.join(', ')}`);

      for (let i = 0; i < firingItems.length; i++) {
        const item = firingItems[i];
        const itemNumber = i + 1;
        const totalItems = firingItems.length;
        
        console.log(`[FIRING-SLIP] Processing item ${itemNumber}/${totalItems}: "${item.productName.translated}"`);
        
        // Add delay between emails to avoid overwhelming email service
        // Skip delay for first item
        if (i > 0) {
          console.log(`[FIRING-SLIP]   - Waiting ${EMAIL_DELAY_MS}ms before next email...`);
          await delay(EMAIL_DELAY_MS);
        }

        // Format this individual item as a printer-friendly slip
        console.log(`[FIRING-SLIP]   - Formatting firing slip...`);
        const firingSlipText = formatSingleFiringSlip(
          customerName, 
          orderNumber, 
          orderDate, 
          item, 
          itemNumber, 
          totalItems
        );
        console.log(`[FIRING-SLIP]   - Slip formatted (${firingSlipText.length} chars)`);

        // Send to each printer contact (in case of multiple printers)
        for (const contactId of PRINTER_CONTACTS) {
          try {
            const contactIndex = PRINTER_CONTACTS.indexOf(contactId);
            const contactName = contactId === CCS_RECEIPT_PRINTER ? 'PRINTER' : 'SLACK';
            
            console.log(`[FIRING-SLIP]   - Attempting send ${contactIndex + 1}/${PRINTER_CONTACTS.length} to ${contactName}`);
            console.log(`[FIRING-SLIP]     Contact ID: ${contactId}`);
            console.log(`[FIRING-SLIP]     Subject: FS - ${customerLastName} - #${orderNumber}`);
            console.log(`[FIRING-SLIP]     Template: ${EMAIL_TEMPLATE_ID}`);
            
            // Log the exact call we're making
            console.log(`[FIRING-SLIP]     Calling triggeredEmails.emailContact...`);
            
            const emailResult = await triggeredEmails.emailContact(
              EMAIL_TEMPLATE_ID,
              contactId,
              {
                variables: {
                  // Subject line components - template must use {{emailSubject}}
                  emailSubject: `FS - ${customerLastName} - #${orderNumber}`,
                  
                  // Main content
                  itemDescription: firingSlipText,
                  
                  // Customer info
                  customerName: customerName,
                  customerEmailAddress: order.buyerInfo.email,
                  customerPhoneNumber: order.billingInfo.contactDetails.phone || 'N/A',
                  
                  // Order info
                  orderNumber: orderNumber,
                  orderDate: orderDate,
                  orderTotalAmount: item.totalPriceAfterTax.formattedAmount,
                  
                  // Item-specific info
                  itemName: item.productName.translated,
                  itemQuantity: item.quantity.toString(),
                  itemPrice: item.price.formattedAmount,
                  
                  // These fields are required by template but not relevant for firing
                  emailAddress: order.buyerInfo.email, // Some templates use this instead
                  receiptNumber: '',
                  tax: '',
                  orderSubtotal: '',
                  paymentDate: orderDate,
                  paymentCard: '',
                  paymentTotal: '',
                  companyName: ''
                }
              }
            );
            
            // Log what the API returned
            console.log(`[FIRING-SLIP]     API Response:`, JSON.stringify(emailResult || 'undefined'));
            
            emailsSent++;
            console.log(`[FIRING-SLIP]   ✓ Email ${contactIndex + 1} (${contactName}) completed - item ${itemNumber}/${totalItems}`);
          } catch (error) {
            const contactName = contactId === CCS_RECEIPT_PRINTER ? 'PRINTER' : 'SLACK';
            emailsFailed++;
            console.error(`[FIRING-SLIP]   ✗ FAILED to send to ${contactName} (${contactId}):`);
            console.error(`[FIRING-SLIP]     Error type: ${error.constructor.name}`);
            console.error(`[FIRING-SLIP]     Error message: ${error.message}`);
            console.error(`[FIRING-SLIP]     Error details:`, JSON.stringify(error));
            console.error(`[FIRING-SLIP]     Error stack:`, error.stack);
            // Don't throw - continue to next recipient
          }
        }
      }

      console.log(`[FIRING-SLIP] ====== Email Send Complete ======`);
      console.log(`[FIRING-SLIP] Summary: ${emailsSent} sent, ${emailsFailed} failed`);
      console.log(`[FIRING-SLIP] Expected: ${firingItems.length * PRINTER_CONTACTS.length} total emails`);
      
      if (emailsFailed > 0) {
        console.warn(`[FIRING-SLIP] WARNING: ${emailsFailed} emails failed to send`);
      }

    } catch (error) {
      console.error(`[FIRING-SLIP] ✗✗✗ CRITICAL ERROR in sendFiringSlip:`);
      console.error(`[FIRING-SLIP] Error message: ${error.message}`);
      console.error(`[FIRING-SLIP] Error stack:`, error.stack);
      throw error;
    }
  }
);

/**
 * Formats a single firing item as a printer-friendly slip with extended ASCII
 * Uses <br> tags for line breaks but avoids other HTML entities
 * 
 * @param {string} customerName - Full customer name
 * @param {string} orderNumber - Friendly order number
 * @param {string} orderDate - Formatted order date
 * @param {object} item - Line item from the order
 * @param {number} itemNumber - Current item number
 * @param {number} totalItems - Total number of firing items in order
 * @returns {string} Formatted text for the firing slip
 */
function formatSingleFiringSlip(customerName, orderNumber, orderDate, item, itemNumber, totalItems) {
  const options = item.catalogReference?.options || {};
  
  // Format dates
  const placedDate = new Date(orderDate).toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Get due date from description lines
  let dueDate = 'Not specified';
  let dueDateObj = null;
  if (item.descriptionLines) {
    const dueDateLine = item.descriptionLines.find(line => 
      line.name?.original === "Due Date"
    );
    if (dueDateLine?.plainText?.original) {
      dueDateObj = new Date(dueDateLine.plainText.original);
      dueDate = dueDateObj.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  }
  
  // Calculate days until due
  let daysUntilDue = '';
  if (dueDateObj) {
    const today = new Date();
    const diffTime = dueDateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysUntilDue = ` (${diffDays} days)`;
  }
  
  // Helper function to decode HTML entities
  function decodeHtmlEntities(text) {
    if (!text) return text;
    return text
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }
  
  // Clean all text values
  const cleanCustomerName = decodeHtmlEntities(customerName);
  const cleanType = decodeHtmlEntities(options.Type || item.productName.translated);
  
  // Build the slip
  let slip = `<br><br>${cleanCustomerName.toUpperCase()}<br><br>`;
  slip += `Order #${orderNumber} - ${placedDate}<br><br>`;
  slip += `Requested by ${dueDate}${daysUntilDue}<br><br>`;
  
  slip += `${cleanType.toUpperCase()}<br>`;
  slip += `${options.Height || '?'}"H x ${options.Width || '?'}"W x ${options.Length || '?'}"D<br>`;
  slip += `${options.Volume || '?'} in³ x ${item.quantity} @ $${options.UnitCost || '0.00'} = ${item.totalPriceAfterTax.formattedAmount}<br>`;
  
  // Add instructions if present
  if (item.descriptionLines) {
    const directionsLine = item.descriptionLines.find(line => 
      line.name?.original === "Special Directions"
    );
    if (directionsLine && directionsLine.plainText?.original !== "None") {
      const cleanDirections = decodeHtmlEntities(directionsLine.plainText.original);
      slip += `<br>INSTRUCTIONS<br>`;
      slip += `${cleanDirections}<br>`;
    }
  }
  
  // Add item number only if multiple items
  if (totalItems > 1) {
    slip += `<br>Item ${itemNumber} of ${totalItems}`;
  }
  
  slip += `<br><br>`;
  
  return slip;
}
/**
 * Formats a single firing item as a printer-friendly slip
 * Each item gets its own slip to accompany the physical pottery piece
 * 
 * @param {string} customerName - Full customer name
 * @param {string} orderNumber - Friendly order number
 * @param {string} orderDate - Formatted order date
 * @param {object} item - Line item from the order
 * @param {number} itemNumber - Current item number
 * @param {number} totalItems - Total number of firing items in order
 * @returns {string} Formatted text for the firing slip
 */
function formatSingleFiringSlip_bak(customerName, orderNumber, orderDate, item, itemNumber, totalItems) {
  // Extract firing-specific options from the catalog reference
  // These come from the firing worksheet widget
  const options = item.catalogReference?.options || {};
  
  let slip = `
${customerName}
Order #: ${orderNumber}
Date: ${orderDate}
Item: ${itemNumber} of ${totalItems}

FIRING DETAILS:
`;

  // Add all the firing-specific information
  slip += `
${options.Type || item.productName.translated}
${options.Height || '?'}" H × ${options.Width || '?'}" W × ${options.Length || '?'}" L
Volume: ${options.Volume || '?'} cubic inches
Quantity: ${item.quantity}
Price: ${item.price.formattedAmount} each
Total: ${item.totalPriceAfterTax.formattedAmount}
`;

  // Extract due date from description lines (added by worksheet)
  if (item.descriptionLines) {
    const dueDateLine = item.descriptionLines.find(line => 
      line.name?.original === "Due Date"
    );
    if (dueDateLine) {
      slip += `Due Date: ${dueDateLine.plainText?.original || 'Not specified'}\n`;
    }

    // Extract special directions from description lines
    const directionsLine = item.descriptionLines.find(line => 
      line.name?.original === "Special Directions"
    );
    if (directionsLine && directionsLine.plainText?.original !== "None") {
      slip += `<BR>SPECIAL DIRECTIONS:<BR>${directionsLine.plainText.original}\n`;
    }
  }

  slip += `
---
`;

  return slip;
}