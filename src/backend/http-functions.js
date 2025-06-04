// src/backend/http-functions.js
import { ok, serverError } from 'wix-http-functions';
import { processWebhook } from 'backend/webhookHandler.web';

export async function post_myWebhook(request) {
    try {
        console.log("=== WEBHOOK REQUEST RECEIVED ===");
        console.log("Headers:", JSON.stringify(request.headers, null, 2));
        console.log("Method:", request.method);
        console.log("URL:", request.url);
        
        // Try to parse JSON payload
        let payload;
        try {
            payload = await request.body.json();
        } catch (jsonError) {
            console.log("JSON parsing failed, trying as text...");
            const textBody = await request.body.text();
            console.log("Raw body:", textBody);
            return serverError({ message: "Invalid JSON payload", rawBody: textBody });
        }
        
        const result = await processWebhook(payload);
        console.log("Webhook processed successfully");
        return ok(result);
        
    } catch (error) {
        console.error("Error handling webhook:", error);
        return serverError({ message: error.message, stack: error.stack });
    }
}