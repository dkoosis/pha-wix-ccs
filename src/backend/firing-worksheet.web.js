import { Permissions, webMethod } from "wix-web-module";
import { currentCart, cart } from "wix-ecom-backend";
import { elevate } from "wix-auth";
import { mediaManager } from "wix-media-backend";

const APP_ID = "97ed05e3-04ed-4095-af45-90587bfed9f0";

/**
 * Adds a worksheet's details to the current shopping cart.
 * @param {Array} worksheetData - Array of worksheet data to be added to the cart.
 * @returns {Promise<Object>} - Updated cart data.
 */
export const addWorksheetToCart = webMethod(
    Permissions.Anyone,
    async (worksheetData) => {
        try {
            console.log("Processing worksheet data:", worksheetData);
            return await generateCustomLineItemsFromWorksheet(worksheetData);
        } catch (error) {
            console.error("Error adding worksheet to cart:", error);
            throw new Error("Failed to add worksheet to cart");
        }
    }
);

/**
 * Uploads an image to the Wix Media Manager.
 * @param {string} buffer64 - Base64 string of the image buffer.
 * @returns {Promise<Object>} - Uploaded media details.
 */
export const uploadImage = webMethod(Permissions.Anyone, async (buffer64) => {
    return mediaManager.upload(
        "/firing-worksheet-Uploads",
        buffer64,
        `firing-${Date.now()}.png`,
        {
            mediaOptions: {
                mimeType: "image/png",
                mediaType: "image",
            },
        }
    );
});

/**
 * Processes worksheet data into custom line items with parallel image processing.
 * @param {Array} worksheetData - Array of worksheet data to be processed.
 * @returns {Promise<Array>} - Array of custom line items.
 */
async function processWorksheetData(worksheetData) {
    try {
        // Start all image uploads in parallel
        const imageUploadPromises = worksheetData
            .filter(item => item.photoBuffer)
            .map(async item => ({
                _id: item._id,
                imageData: await uploadImage(item.photoBuffer).catch(error => {
                    console.error(`Failed to upload image for item ${item._id}:`, error);
                    return null;
                })
            }));

        // Wait for all image uploads to complete
        const uploadedImages = await Promise.all(imageUploadPromises);
        
        // Create a map for quick image URL lookup
        const imageUrlMap = new Map(
            uploadedImages
                .filter(({imageData}) => imageData !== null)
                .map(({_id, imageData}) => [_id, imageData.fileUrl])
        );

        // Create all line items
        return worksheetData.map(item => ({
            itemType: { custom: "custom" },
            media: imageUrlMap.get(item._id) || "",
            price: item.price.toString(),
            priceDescription: { original: item.price.toString() },
            descriptionLines: [
                {
                    name: { original: "Due Date" },
                    plainText: { original: item.dueDate },
                },
                {
                    name: { original: "Special Directions" },
                    plainText: { original: item?.specialDirections || "" },
                },
                {
                    name: { original: "Height" },
                    plainText: { original: item.height.toString() },
                },
                {
                    name: { original: "Width" },
                    plainText: { original: item.width.toString() },
                },
                {
                    name: { original: "Length" },
                    plainText: { original: item.length.toString() },
                },
            ],
            productName: { original: item.firingType },
            catalogReference: {
                appId: APP_ID,
                catalogItemId: item._id,
                options: {
                    Type: item.firingType,
                    Height: item.height.toString(),
                    Width: item.width.toString(),
                    Length: item.length.toString(),
                    Image: imageUrlMap.get(item._id) || "",
                },
            },
            quantity: item.quantity,
        }));
    } catch (error) {
        console.error("Error processing worksheet data:", error);
        throw error;
    }
}

/**
 * Generates custom line items from worksheet data and manages cart operations.
 * @param {Array} worksheetData - Array of worksheet data to be processed.
 * @returns {Promise<Object>} - Updated or newly created cart.
 */
async function generateCustomLineItemsFromWorksheet(worksheetData) {
    try {
        const [existingCart, customLineItems] = await Promise.all([
            elevate(currentCart.getCurrentCart)(),
            processWorksheetData(worksheetData)
        ]);

        if (!existingCart) {
            const elevatedCreateCart = elevate(cart.createCart);
            return await elevatedCreateCart({ customLineItems });
        }

        // Remove existing custom items
        const firingItems = existingCart.lineItems.filter(
            item => item.itemType.custom === "custom"
        );
        
        if (firingItems.length) {
            await currentCart.removeLineItemsFromCurrentCart(
                firingItems.map(item => item._id)
            );
        }

        // Add new items
        const elevatedAddToCart = elevate(currentCart.addToCurrentCart);
        return await elevatedAddToCart({ customLineItems });
    } catch (error) {
        console.error("Error generating custom line items:", error);
        return handleFallbackCartCreation(worksheetData);
    }
}

/**
 * Handles fallback cart creation in case of errors.
 * @param {Array} worksheetData - Array of worksheet data for fallback.
 * @returns {Promise<Object>} - Newly created cart data.
 */
async function handleFallbackCartCreation(worksheetData) {
    try {
        const customLineItems = await processWorksheetData(worksheetData);
        const elevatedCreateCart = elevate(cart.createCart);
        const newCart = await elevatedCreateCart({ customLineItems });
        console.log("Fallback: New cart created:", newCart);
        return newCart;
    } catch (fallbackError) {
        console.error("Error during fallback cart creation:", fallbackError);
        throw new Error("Failed to create cart during fallback");
    }
}