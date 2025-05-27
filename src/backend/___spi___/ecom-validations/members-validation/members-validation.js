import * as ecomValidations from 'interfaces-ecommerce-v1-validations-provider';
import wixMembersBackend from 'wix-members-backend';
import { products } from "wix-stores.v2";
import { bookings } from "wix-bookings-backend";
import { services } from "wix-bookings.v2";

/**
 * This method retrieves validation violations from your app.
 *
 * Wix calls this method when certain actions are performed on a visitor's cart and checkout. For example, when an item is added to the cart, or when a coupon is added to a checkout.
 * This method validates a visitor's cart and checkout, and returns any validation violations (using the structure provided by Wix eCommerce). Site visitors can see the validation violations in their cart and checkout pages. If there aren't any validation violations, the method returns an object containing an empty list.
 *
 * > __Notes:__
 * > + Do not call the Estimate Cart Totals, Estimate Current Cart Totals or Get Checkout methods from your implementation code for Get Validation Violations. Doing so will result in an error.
 * > + By default, this method only retrieves validation violations from a visitor's checkout. If you want to also retrieve validation violations from a visitor's cart, set the `validateInCart` parameter to `true` in the Ecom Validations Integration's config file.
 * @param {import('interfaces-ecommerce-v1-validations-provider').GetValidationViolationsOptions} options
 * @param {import('interfaces-ecommerce-v1-validations-provider').Context} context
 * @returns {Promise<import('interfaces-ecommerce-v1-validations-provider').GetValidationViolationsResponse | import('interfaces-ecommerce-v1-validations-provider').BusinessError>}
 */
const PUBLIC_ROLE_ID = "2ade445c-7265-420a-8102-484abdd3dc54";
const INVITEE_ROLE_ID = "4ecb331a-1566-4879-9112-65103b74dd70";
const STUDIO_MEMBER_ROLE_ID = "ad647c5b-efc7-4c21-b196-376d6ccd85b8";

// Store Category IDs
const PUBLIC_CATEGORY_ID = "73ee77a3-8088-44de-25b0-2f7036230425";
const INVITEE_CATEGORY_ID = "c2465f08-2bee-800c-fe57-552cac54872e";
const STUDIO_MEMBER_CATEGORY_ID = "87b5bf4f-950d-2892-74cb-58456a5cd88d";

//Booking Category IDs
const MEMBER_SERVICE = "6be9f851-aa3e-405f-9d4c-7beb883cc289"
const PUBLIC_SERVICE = "76184047-3013-4429-aca4-da6424aa69ca"
const INVITEE_SERVICE = "cf7c4ce0-fa48-4792-aa7d-715b9da5b578"

// getValidationViolations function remains unchanged, but uses updated logic
export const getValidationViolations = async (options, context) => {
    try {
        console.log("Options:", options);
        // Retrieve the current member's roles
        const memberRoles = await wixMembersBackend.currentMember.getRoles();
        const roleIds = memberRoles.map(role => role._id);
        console.log("mem", memberRoles);
        // Determine allowed categories based on roles
        const allowedCategories = determineAllowedCategories(roleIds);
        console.log("Allowed categories:", allowedCategories);

        if (!allowedCategories.allowedProductCategories.length && !allowedCategories.allowedBookingCategories.length) {
            console.warn("No matching role found. Access denied.");
            return {
                violations: [{
                    severity: "ERROR",
                    target: { other: { name: "OTHER_DEFAULT" } },
                    description: "Some items are restricted based on your role.",
                }]
            };
        }
        // Validate line items
        return await validateLineItems(options.validationInfo.lineItems, allowedCategories);
    } catch (error) {
        console.error("Error in getValidationViolations:", error);
        const fallbackCategories = {
            allowedProductCategories: [PUBLIC_CATEGORY_ID],
            allowedBookingCategories: [PUBLIC_SERVICE]
        };
        return await validateLineItems(options.validationInfo.lineItems, fallbackCategories);
    }
};

// Helper function to determine allowed categories based on roles
const determineAllowedCategories = (roleIds) => {
    let allowedProductCategories = [PUBLIC_CATEGORY_ID];
    let allowedBookingCategories = [PUBLIC_SERVICE];

    if (roleIds.includes(STUDIO_MEMBER_ROLE_ID)) {
        allowedProductCategories.push(STUDIO_MEMBER_CATEGORY_ID);
        allowedBookingCategories.push(MEMBER_SERVICE);
    }
    if (roleIds.includes(INVITEE_ROLE_ID)) {
        allowedProductCategories.push(INVITEE_CATEGORY_ID);
        allowedBookingCategories.push(INVITEE_SERVICE);
    }

    return { allowedProductCategories, allowedBookingCategories };
};

// Updated validateLineItems function
const validateLineItems = async (lineItems, allowedCategories) => {
    const { allowedProductCategories, allowedBookingCategories } = allowedCategories;

    const filteredLineItems = await Promise.all(
        lineItems.map(async (item) => {
            let isAllowed = false;

            if (item.catalogReference.appId == "215238eb-22a5-4c36-9e7b-e7c08025e04e") {
                // Product validation
                const { product } = await getProduct(item.catalogReference.catalogItemId);
                isAllowed = product.collectionIds.some(collectionId =>
                    allowedProductCategories.includes(collectionId)
                );
            } else if (item.catalogReference.appId == "13d21c63-b5ec-5912-8397-c3a5ddb27a97") {
                // Booking service validation
                const service = await queryBookings(item.catalogReference.catalogItemId);
                console.log("Service category:", service.category._id);
                isAllowed = allowedBookingCategories.includes(service.category._id);
            } else if (item.catalogReference.appId == "97ed05e3-04ed-4095-af45-90587bfed9f0") {
                isAllowed = true
            }

            return isAllowed ? item : null;
        })
    );

    const validLineItems = filteredLineItems.filter(item => item !== null);
    console.log("Valid items:", validLineItems.length, "Total items:", lineItems.length);

    const violations = [];
    if (validLineItems.length !== lineItems.length) {
        violations.push({
            severity: "ERROR",
            target: { other: { name: "OTHER_DEFAULT" } },
            description: "Some items are restricted based on your role.",
        });
    }

    return { violations };
};

async function getProduct(id, options) {
    try {
        const result = await products.getProduct(id, options);
        return result;
    } catch (error) {
        console.error(error);
        // Handle the error
    }
}

export const queryBookings = async (id) => {
    try {
        const { items } = await bookings
            .queryBookings()
            .hasSome("_id", id)
            .find({ suppressAuth: true })
        const service = await getService(items[0].bookedEntity.serviceId)
        return service
    } catch (error) {
        throw new Error("Error")
    }
};

/*
 * Sample serviceId value: 'ff61204b-b19a-5cc8-823b-7eed8ae5fc28'
 */
async function getService(serviceId) {
    try {
        return services.getService(serviceId);
    } catch (error) {
        console.error(error);
        // Handle the error
    }
}