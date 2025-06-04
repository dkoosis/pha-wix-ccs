import { ok, serverError } from 'wix-http-functions';
import { processWebhook } from 'backend/webhookHandler.web';

export async function post_myWebhook(request) {
    try {
        const payload = await request.body.json();
        const result = await processWebhook(payload);
        return ok(result);
    } catch (error) {
        console.error("Error handling webhook:", error);
        return serverError({ message: error.message });
    }
}