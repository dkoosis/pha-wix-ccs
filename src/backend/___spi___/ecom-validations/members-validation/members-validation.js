import * as ecomValidations from 'interfaces-ecommerce-v1-validations-provider';
import wixMembersBackend from 'wix-members-backend';
import { products } from "wix-stores.v2";
import { bookings } from "wix-bookings-backend";
import { services } from "wix-bookings.v2";
import { ROLES, STORE_CATEGORIES, BOOKING_CATEGORIES } from 'public/constants.js';

/**
 * This method retrieves validation violations from your app.
 * Updated to use centralized constants.
 */

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
            allowedProductCategories: [STORE_CATEGORIES.PUBLIC],
            allowedBookingCategories: [BOOKING_CATEGORIES.PUBLIC]
        };
        return await validateLineItems(options.validationInfo.lineItems, fallbackCategories);
    }
};

// Helper function to determine allowed categories based on roles
const determineAllowedCategories = (roleIds) => {
    let allowedProductCategories = [STORE_CATEGORIES.PUBLIC];
    let allowedBookingCategories = [BOOKING_CATEGORIES.PUBLIC];

    if (roleIds.includes(ROLES.CCS_MEMBER.ID)) {
        allowedProductCategories.push(STORE_CATEGORIES.STUDIO_MEMBER);
        allowedBookingCategories.push(BOOKING_CATEGORIES.MEMBER);
    }
    if (roleIds.includes(ROLES.CCS_INVITEE.ID)) {
        allowedProductCategories.push(STORE_CATEGORIES.INVITEE);
        allowedBookingCategories.push(BOOKING_CATEGORIES.INVITEE);
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
