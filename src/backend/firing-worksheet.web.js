import { Permissions, webMethod } from "wix-web-module";
import { currentCart, cart } from "wix-ecom-backend";
import { elevate } from "wix-auth";
import { mediaManager } from "wix-media-backend";

// Application ID for catalog reference
const APP_ID = "97ed05e3-04ed-4095-af45-90587bfed9f0";

// Configuration constants
const CONFIG = {
<<<<<<< HEAD
    UPLOAD_PATH: "/firing-worksheet-uploads",
    IMAGE_MIME_TYPE: "image/png",
    MAX_PARALLEL_UPLOADS: 10,
    FALLBACK_RETRY_ATTEMPTS: 2
=======
  UPLOAD_PATH: "/firing-worksheet-uploads",
  IMAGE_MIME_TYPE: "image/png",
  MAX_PARALLEL_UPLOADS: 10,
  FALLBACK_RETRY_ATTEMPTS: 2,
>>>>>>> d1edb2a (firing commit)
};

/**
 * Main web method to add worksheet data to shopping cart
 * @param {Array} worksheetData - Array of worksheet line items
 * @returns {Promise<Object>} Updated or newly created cart data
 */
export const addWorksheetToCart = webMethod(
<<<<<<< HEAD
    Permissions.Anyone,
    async (worksheetData) => {
        try {
            console.log("Processing worksheet data:", {
                itemCount: worksheetData?.length || 0,
                timestamp: new Date().toISOString()
            });

            // Validate input data
            if (!Array.isArray(worksheetData) || worksheetData.length === 0) {
                throw new Error("Invalid worksheet data: expected non-empty array");
            }

            return await generateCustomLineItemsFromWorksheet(worksheetData);
        } catch (error) {
            console.error("Error adding worksheet to cart:", {
                error: error.message,
                stack: error.stack,
                worksheetData: worksheetData?.length || 0
            });
            throw new Error(`Failed to add worksheet to cart: ${error.message}`);
        }
    }
=======
  Permissions.Anyone,
  async (worksheetData) => {
    try {
      console.log("Processing worksheet data:", {
        itemCount: worksheetData?.length || 0,
        timestamp: new Date().toISOString(),
      });

      // Validate input data
      if (!Array.isArray(worksheetData) || worksheetData.length === 0) {
        throw new Error("Invalid worksheet data: expected non-empty array");
      }

      return await generateCustomLineItemsFromWorksheet(worksheetData);
    } catch (error) {
      console.error("Error adding worksheet to cart:", {
        error: error.message,
        stack: error.stack,
        worksheetData: worksheetData?.length || 0,
      });
      throw new Error(`Failed to add worksheet to cart: ${error.message}`);
    }
  }
>>>>>>> d1edb2a (firing commit)
);

/**
 * Upload image to Wix Media Manager with error handling
 * @param {string} buffer64 - Base64 encoded image data
 * @param {string} itemId - Item ID for unique filename generation
 * @returns {Promise<Object>} Uploaded media details
 */
export const uploadImage = webMethod(
<<<<<<< HEAD
    Permissions.Anyone, 
    async (buffer64, itemId = null) => {
        try {
            // Validate input
            if (!buffer64 || typeof buffer64 !== 'string') {
                throw new Error("Invalid image data: expected base64 string");
            }

            // Generate unique filename
            const timestamp = Date.now();
            const uniqueId = itemId || Math.random().toString(36).substr(2, 9);
            const filename = `firing-${uniqueId}-${timestamp}.png`;

            console.log(`Uploading image: ${filename}`);

            const uploadResult = await mediaManager.upload(
                CONFIG.UPLOAD_PATH,
                buffer64,
                filename,
                {
                    mediaOptions: {
                        mimeType: CONFIG.IMAGE_MIME_TYPE,
                        mediaType: "image",
                    },
                }
            );

            console.log(`Image uploaded successfully: ${uploadResult.fileUrl}`);
            return uploadResult;

        } catch (error) {
            console.error("Image upload failed:", {
                error: error.message,
                itemId,
                bufferLength: buffer64?.length || 0
            });
            throw new Error(`Image upload failed: ${error.message}`);
        }
    }
=======
  Permissions.Anyone,
  async (buffer64, itemId = null) => {
    try {
      // Validate input
      if (!buffer64 || typeof buffer64 !== "string") {
        throw new Error("Invalid image data: expected base64 string");
      }

      // Generate unique filename
      const timestamp = Date.now();
      const uniqueId = itemId || Math.random().toString(36).substr(2, 9);
      const filename = `firing-${uniqueId}-${timestamp}.png`;

      console.log(`Uploading image: ${filename}`);

      const uploadResult = await mediaManager.upload(
        CONFIG.UPLOAD_PATH,
        buffer64,
        filename,
        {
          mediaOptions: {
            mimeType: CONFIG.IMAGE_MIME_TYPE,
            mediaType: "image",
          },
        }
      );

      console.log(`Image uploaded successfully: ${uploadResult.fileUrl}`);
      return uploadResult;
    } catch (error) {
      console.error("Image upload failed:", {
        error: error.message,
        itemId,
        bufferLength: buffer64?.length || 0,
      });
      throw new Error(`Image upload failed: ${error.message}`);
    }
  }
>>>>>>> d1edb2a (firing commit)
);

/**
 * Process worksheet data with parallel image uploads and comprehensive error handling
 * @param {Array} worksheetData - Array of worksheet items to process
 * @returns {Promise<Array>} Array of processed custom line items
 */
async function processWorksheetData(worksheetData) {
<<<<<<< HEAD
    try {
        console.log(`Processing ${worksheetData.length} worksheet items`);

        // Validate worksheet data structure
        const validationErrors = validateWorksheetStructure(worksheetData);
        if (validationErrors.length > 0) {
            throw new Error(`Worksheet validation failed: ${validationErrors.join('; ')}`);
        }

        // Filter items that have photos and start parallel uploads
        const itemsWithPhotos = worksheetData.filter(item => 
            item.photoBuffer && typeof item.photoBuffer === 'string'
        );

        console.log(`Starting ${itemsWithPhotos.length} parallel image uploads`);

        // Process image uploads in batches to avoid overwhelming the system
        const imageUploadPromises = itemsWithPhotos.map(async (item, index) => {
            try {
                // Add small delay to prevent rate limiting
                if (index > 0 && index % CONFIG.MAX_PARALLEL_UPLOADS === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                const imageData = await uploadImage(item.photoBuffer, item._id);
                return {
                    _id: item._id,
                    imageData,
                    success: true
                };
            } catch (error) {
                console.error(`Failed to upload image for item ${item._id}:`, error);
                return {
                    _id: item._id,
                    imageData: null,
                    success: false,
                    error: error.message
                };
            }
        });

        // Wait for all image uploads to complete
        const uploadResults = await Promise.all(imageUploadPromises);
        
        // Log upload statistics
        const successCount = uploadResults.filter(result => result.success).length;
        const failureCount = uploadResults.length - successCount;
        console.log(`Image upload results: ${successCount} successful, ${failureCount} failed`);

        // Create map for quick image URL lookup
        const imageUrlMap = new Map(
            uploadResults
                .filter(result => result.success && result.imageData)
                .map(result => [result._id, result.imageData.fileUrl])
        );

        // Create custom line items with enhanced error handling
        return worksheetData.map((item, index) => {
            try {
                return createCustomLineItem(item, imageUrlMap.get(item._id));
            } catch (error) {
                console.error(`Error creating line item ${index + 1}:`, error);
                throw new Error(`Failed to create line item ${index + 1}: ${error.message}`);
            }
        });

    } catch (error) {
        console.error("Error processing worksheet data:", error);
        throw error;
    }
=======
  try {
    console.log(`Processing ${worksheetData.length} worksheet items`);

    // Validate worksheet data structure
    const validationErrors = validateWorksheetStructure(worksheetData);
    if (validationErrors.length > 0) {
      throw new Error(
        `Worksheet validation failed: ${validationErrors.join("; ")}`
      );
    }

    // Filter items that have photos and start parallel uploads
    const itemsWithPhotos = worksheetData.filter(
      (item) => item.photoBuffer && typeof item.photoBuffer === "string"
    );

    console.log(`Starting ${itemsWithPhotos.length} parallel image uploads`);

    // Process image uploads in batches to avoid overwhelming the system
    const imageUploadPromises = itemsWithPhotos.map(async (item, index) => {
      try {
        const isUrl =
          typeof item.photoBuffer === "string" &&
          item.photoBuffer.startsWith("wix");

        // If already a URL, no need to upload
        if (isUrl) {
          return {
            _id: item._id,
            imageData: { fileUrl: "wix:image://v1/4df3a3_fae918872a294e8b8e64dbbd4e82e12c~mv2.png/firing.png#originWidth=1000&originHeight=1000" },
            success: true,
          };
        }

        // Add small delay to prevent rate limiting
        if (index > 0 && index % CONFIG.MAX_PARALLEL_UPLOADS === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const imageData = await uploadImage(item.photoBuffer, item._id);
        return {
          _id: item._id,
          imageData,
          success: true,
        };
      } catch (error) {
        console.error(`Failed to upload image for item ${item._id}:`, error);
        return {
          _id: item._id,
          imageData: null,
          success: false,
          error: error.message,
        };
      }
    });

    // Wait for all image uploads to complete
    const uploadResults = await Promise.all(imageUploadPromises);

    // Log upload statistics
    const successCount = uploadResults.filter(
      (result) => result.success
    ).length;
    const failureCount = uploadResults.length - successCount;
    console.log(
      `Image upload results: ${successCount} successful, ${failureCount} failed`
    );

    // Create map for quick image URL lookup
    const imageUrlMap = new Map(
      uploadResults
        .filter((result) => result.success && result.imageData)
        .map((result) => [result._id, result.imageData.fileUrl])
    );

    // Create custom line items with enhanced error handling
    return worksheetData.map((item, index) => {
      try {
        return createCustomLineItem(item, imageUrlMap.get(item._id));
      } catch (error) {
        console.error(`Error creating line item ${index + 1}:`, error);
        throw new Error(
          `Failed to create line item ${index + 1}: ${error.message}`
        );
      }
    });
  } catch (error) {
    console.error("Error processing worksheet data:", error);
    throw error;
  }
>>>>>>> d1edb2a (firing commit)
}

/**
 * Validate worksheet data structure before processing
 * @param {Array} worksheetData - Data to validate
 * @returns {Array} Array of validation error messages
 */
function validateWorksheetStructure(worksheetData) {
<<<<<<< HEAD
    const errors = [];

    worksheetData.forEach((item, index) => {
        const itemNum = index + 1;
        
        // Required fields validation
        if (!item._id) errors.push(`Item ${itemNum}: Missing _id`);
        if (!item.firingType) errors.push(`Item ${itemNum}: Missing firingType`);
        if (typeof item.price !== 'number' || item.price < 0) {
            errors.push(`Item ${itemNum}: Invalid price`);
        }
        if (!Number.isInteger(item.height) || item.height <= 0) {
            errors.push(`Item ${itemNum}: Invalid height`);
        }
        if (!Number.isInteger(item.width) || item.width <= 0) {
            errors.push(`Item ${itemNum}: Invalid width`);
        }
        if (!Number.isInteger(item.length) || item.length <= 0) {
            errors.push(`Item ${itemNum}: Invalid length`);
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
            errors.push(`Item ${itemNum}: Invalid quantity`);
        }
        
        // Optional field validation
        if (item.photoBuffer && typeof item.photoBuffer !== 'string') {
            errors.push(`Item ${itemNum}: Invalid photoBuffer format`);
        }
    });

    return errors;
=======
  const errors = [];

  worksheetData.forEach((item, index) => {
    const itemNum = index + 1;

    // Required fields validation
    if (!item._id) errors.push(`Item ${itemNum}: Missing _id`);
    if (!item.firingType) errors.push(`Item ${itemNum}: Missing firingType`);
    if (typeof item.price !== "number" || item.price < 0) {
      errors.push(`Item ${itemNum}: Invalid price`);
    }
    if (!Number.isInteger(item.height) || item.height <= 0) {
      errors.push(`Item ${itemNum}: Invalid height`);
    }
    if (!Number.isInteger(item.width) || item.width <= 0) {
      errors.push(`Item ${itemNum}: Invalid width`);
    }
    if (!Number.isInteger(item.length) || item.length <= 0) {
      errors.push(`Item ${itemNum}: Invalid length`);
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      errors.push(`Item ${itemNum}: Invalid quantity`);
    }

    // Optional field validation
    if (item.photoBuffer && typeof item.photoBuffer !== "string") {
      errors.push(`Item ${itemNum}: Invalid photoBuffer format`);
    }
  });

  return errors;
>>>>>>> d1edb2a (firing commit)
}

/**
 * Create a custom line item from worksheet data
 * @param {Object} item - Worksheet item data
 * @param {string} imageUrl - Optional image URL
 * @returns {Object} Custom line item for Wix cart
 */
<<<<<<< HEAD
function createCustomLineItem(item, imageUrl = "") {
    return {
        itemType: { custom: "custom" },
        media: imageUrl,
        price: item.price.toString(),
        priceDescription: { original: item.price.toString() },
        descriptionLines: [
            {
                name: { original: "Due Date" },
                plainText: { original: item.dueDate || "Not specified" },
            },
            {
                name: { original: "Special Directions" },
                plainText: { original: item.specialDirections || "None" },
            },
            {
                name: { original: "Dimensions (H×W×L)" },
                plainText: { original: `${item.height}×${item.width}×${item.length} inches` },
            },
            {
                name: { original: "Volume" },
                plainText: { original: `${item.volume || (item.height * item.width * item.length)} cubic inches` },
            },
        ],
        productName: { original: `${item.firingType} Firing Service` },
        catalogReference: {
            appId: APP_ID,
            catalogItemId: item._id,
            options: {
                Type: item.firingType,
                Height: item.height.toString(),
                Width: item.width.toString(),
                Length: item.length.toString(),
                Volume: (item.volume || (item.height * item.width * item.length)).toString(),
                Image: imageUrl,
                UnitCost: (item.unitCost || 0).toString()
            },
        },
        quantity: item.quantity,
    };
=======
function createCustomLineItem(
  item,
  imageUrl = "wix:image://v1/4df3a3_fae918872a294e8b8e64dbbd4e82e12c~mv2.png/firing.png#originWidth=1000&originHeight=1000"
) {
  return {
    itemType: { custom: "custom" },
    media: imageUrl,
    price: item.price.toString(),
    priceDescription: { original: item.price.toString() },
    descriptionLines: [
      {
        name: { original: "Due Date" },
        plainText: { original: item.dueDate || "Not specified" },
      },
      {
        name: { original: "Special Directions" },
        plainText: { original: item.specialDirections || "None" },
      },
      {
        name: { original: "Dimensions (H×W×L)" },
        plainText: {
          original: `${item.height}×${item.width}×${item.length} inches`,
        },
      },
      {
        name: { original: "Volume" },
        plainText: {
          original: `${
            item.volume || item.height * item.width * item.length
          } cubic inches`,
        },
      },
    ],
    productName: { original: `${item.firingType} Firing Service` },
    catalogReference: {
      appId: APP_ID,
      catalogItemId: item._id,
      options: {
        Type: item.firingType,
        Height: item.height.toString(),
        Width: item.width.toString(),
        Length: item.length.toString(),
        Volume: (
          item.volume || item.height * item.width * item.length
        ).toString(),
        Image: imageUrl,
        UnitCost: (item.unitCost || 0).toString(),
      },
    },
    quantity: item.quantity,
  };
>>>>>>> d1edb2a (firing commit)
}

/**
 * Main function to generate custom line items and manage cart operations
 * @param {Array} worksheetData - Processed worksheet data
 * @returns {Promise<Object>} Updated or newly created cart
 */
async function generateCustomLineItemsFromWorksheet(worksheetData) {
<<<<<<< HEAD
    try {
        console.log("Generating custom line items from worksheet data");

        // Process worksheet data and get current cart in parallel
        const [customLineItems, existingCart] = await Promise.all([
            processWorksheetData(worksheetData),
            elevate(currentCart.getCurrentCart)().catch(error => {
                console.warn("Could not retrieve current cart:", error.message);
                return null;
            })
        ]);

        console.log(`Generated ${customLineItems.length} custom line items`);

        // If no existing cart, create new one
        if (!existingCart) {
            console.log("No existing cart found, creating new cart");
            return await createNewCartWithItems(customLineItems);
        }

        console.log(`Found existing cart with ${existingCart.lineItems?.length || 0} items`);

        // Remove existing firing service items from cart
        await removeExistingFiringItems(existingCart);

        // Add new custom line items to cart
        return await addItemsToExistingCart(customLineItems);

    } catch (error) {
        console.error("Error in generateCustomLineItemsFromWorksheet:", error);
        
        // Attempt fallback cart creation
        console.log("Attempting fallback cart creation");
        return await handleFallbackCartCreation(worksheetData);
    }
=======
  try {
    console.log("Generating custom line items from worksheet data");

    // Process worksheet data and get current cart in parallel
    const [customLineItems, existingCart] = await Promise.all([
      processWorksheetData(worksheetData),
      elevate(currentCart.getCurrentCart)().catch((error) => {
        console.warn("Could not retrieve current cart:", error.message);
        return null;
      }),
    ]);

    console.log(`Generated ${customLineItems.length} custom line items`);

    // If no existing cart, create new one
    if (!existingCart) {
      console.log("No existing cart found, creating new cart");
      return await createNewCartWithItems(customLineItems);
    }

    console.log(
      `Found existing cart with ${existingCart.lineItems?.length || 0} items`
    );

    // Remove existing firing service items from cart
    await removeExistingFiringItems(existingCart);
    console.log("custom line items", customLineItems);

    // Add new custom line items to cart
    return await addItemsToExistingCart(customLineItems);
  } catch (error) {
    console.error("Error in generateCustomLineItemsFromWorksheet:", error);

    // Attempt fallback cart creation
    console.log("Attempting fallback cart creation");
    return await handleFallbackCartCreation(worksheetData);
  }
>>>>>>> d1edb2a (firing commit)
}

/**
 * Create new cart with custom line items
 * @param {Array} customLineItems - Line items to add to new cart
 * @returns {Promise<Object>} Newly created cart
 */
async function createNewCartWithItems(customLineItems) {
<<<<<<< HEAD
    try {
        const elevatedCreateCart = elevate(cart.createCart);
        const newCart = await elevatedCreateCart({ customLineItems });
        
        console.log("New cart created successfully:", {
            cartId: newCart._id,
            itemCount: newCart.lineItems?.length || 0
        });
        
        return newCart;
    } catch (error) {
        console.error("Failed to create new cart:", error);
        throw new Error(`Cart creation failed: ${error.message}`);
    }
=======
  try {
    const elevatedCreateCart = elevate(cart.createCart);
    const newCart = await elevatedCreateCart({ customLineItems });

    console.log("New cart created successfully:", {
      cartId: newCart._id,
      itemCount: newCart.lineItems?.length || 0,
    });

    return newCart;
  } catch (error) {
    console.error("Failed to create new cart:", error);
    throw new Error(`Cart creation failed: ${error.message}`);
  }
>>>>>>> d1edb2a (firing commit)
}

/**
 * Remove existing firing service items from cart
 * @param {Object} existingCart - Current cart object
 * @returns {Promise<void>}
 */
async function removeExistingFiringItems(existingCart) {
<<<<<<< HEAD
    try {
        // Find existing custom firing items
        const firingItems = existingCart.lineItems.filter(
            item => item.itemType?.custom === "custom" && 
                   item.catalogReference?.appId === APP_ID
        );
        
        if (firingItems.length > 0) {
            console.log(`Removing ${firingItems.length} existing firing items from cart`);
            
            await currentCart.removeLineItemsFromCurrentCart(
                firingItems.map(item => item._id)
            );
            
            console.log("Existing firing items removed successfully");
        } else {
            console.log("No existing firing items found in cart");
        }
    } catch (error) {
        console.error("Error removing existing firing items:", error);
        // Don't throw here - continue with adding new items
    }
=======
  try {
    // Find existing custom firing items
    const firingItems = existingCart.lineItems.filter(
      (item) =>
        item.itemType?.custom === "custom" &&
        item.catalogReference?.appId === APP_ID
    );

    if (firingItems.length > 0) {
      console.log(
        `Removing ${firingItems.length} existing firing items from cart`
      );

      await currentCart.removeLineItemsFromCurrentCart(
        firingItems.map((item) => item._id)
      );

      console.log("Existing firing items removed successfully");
    } else {
      console.log("No existing firing items found in cart");
    }
  } catch (error) {
    console.error("Error removing existing firing items:", error);
    // Don't throw here - continue with adding new items
  }
>>>>>>> d1edb2a (firing commit)
}

/**
 * Add new items to existing cart
 * @param {Array} customLineItems - Items to add
 * @returns {Promise<Object>} Updated cart
 */
async function addItemsToExistingCart(customLineItems) {
<<<<<<< HEAD
    try {
        const elevatedAddToCart = elevate(currentCart.addToCurrentCart);
        const updatedCart = await elevatedAddToCart({ customLineItems });
        
        console.log("Items added to existing cart successfully:", {
            cartId: updatedCart._id,
            newItemCount: customLineItems.length,
            totalItemCount: updatedCart.lineItems?.length || 0
        });
        
        return updatedCart;
    } catch (error) {
        console.error("Failed to add items to existing cart:", error);
        throw new Error(`Failed to update cart: ${error.message}`);
    }
=======
  try {
    const elevatedAddToCart = elevate(currentCart.addToCurrentCart);
    const updatedCart = await elevatedAddToCart({ customLineItems });

    console.log("Items added to existing cart successfully:", {
      cartId: updatedCart.cart._id,
      newItemCount: customLineItems.length,
      totalItemCount: updatedCart.cart.lineItems?.length || 0,
    });

    return updatedCart;
  } catch (error) {
    console.error("Failed to add items to existing cart:", error);
    throw new Error(`Failed to update cart: ${error.message}`);
  }
>>>>>>> d1edb2a (firing commit)
}

/**
 * Handle fallback cart creation in case of errors
 * @param {Array} worksheetData - Original worksheet data for fallback processing
 * @returns {Promise<Object>} Newly created fallback cart
 */
async function handleFallbackCartCreation(worksheetData) {
<<<<<<< HEAD
    let lastError;
    
    for (let attempt = 1; attempt <= CONFIG.FALLBACK_RETRY_ATTEMPTS; attempt++) {
        try {
            console.log(`Fallback cart creation attempt ${attempt}/${CONFIG.FALLBACK_RETRY_ATTEMPTS}`);
            
            // Process data again without images for fallback
            const fallbackItems = worksheetData.map(item => 
                createCustomLineItem({
                    ...item,
                    photoBuffer: null // Skip images in fallback
                })
            );
            
            const elevatedCreateCart = elevate(cart.createCart);
            const newCart = await elevatedCreateCart({ 
                customLineItems: fallbackItems 
            });
            
            console.log("Fallback cart created successfully:", {
                cartId: newCart._id,
                itemCount: newCart.lineItems?.length || 0,
                attempt
            });
            
            return newCart;
            
        } catch (fallbackError) {
            lastError = fallbackError;
            console.error(`Fallback attempt ${attempt} failed:`, fallbackError);
            
            // Wait before retry (except on last attempt)
            if (attempt < CONFIG.FALLBACK_RETRY_ATTEMPTS) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }
    
    console.error("All fallback attempts failed");
    throw new Error(`Failed to create cart after ${CONFIG.FALLBACK_RETRY_ATTEMPTS} attempts: ${lastError.message}`);
}
=======
  let lastError;

  for (let attempt = 1; attempt <= CONFIG.FALLBACK_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(
        `Fallback cart creation attempt ${attempt}/${CONFIG.FALLBACK_RETRY_ATTEMPTS}`
      );

      // Process data again without images for fallback
      const fallbackItems = worksheetData.map((item) =>
        createCustomLineItem({
          ...item,
          photoBuffer: null, // Skip images in fallback
        })
      );

      const elevatedCreateCart = elevate(cart.createCart);
      const newCart = await elevatedCreateCart({
        customLineItems: fallbackItems,
      });

      console.log("Fallback cart created successfully:", {
        cartId: newCart._id,
        itemCount: newCart.lineItems?.length || 0,
        attempt,
      });

      return newCart;
    } catch (fallbackError) {
      lastError = fallbackError;
      console.error(`Fallback attempt ${attempt} failed:`, fallbackError);

      // Wait before retry (except on last attempt)
      if (attempt < CONFIG.FALLBACK_RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error("All fallback attempts failed");
  throw new Error(
    `Failed to create cart after ${CONFIG.FALLBACK_RETRY_ATTEMPTS} attempts: ${lastError.message}`
  );
}
>>>>>>> d1edb2a (firing commit)
