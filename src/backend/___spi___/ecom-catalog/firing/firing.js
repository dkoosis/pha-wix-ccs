import * as ecomCatalog from 'interfaces-ecommerce-v1-catalog-provider';

/**
 * Retrieves data for specified items in a specified catalog.
 *
 * Wix calls this method whenever a cart or checkout is updated, and when an item is added to an order.
 *
 * The method receives a `catalogReferences` array. Each catalog reference in the array contains:
 * + The ID of the item whose latest information Wix needs to retrieve.
 * + The ID of the app providing the catalog containing the item.
 * + Optional details about preferences or customization of the item.
 *
 * The method also receives preferences for the currency and weight unit to be used in the response.
 *
 * Your external catalog can store and organize item details in any way you prefer.
 * When implementing the Catalog service plugin, learn how to [handle item variants](https://dev.wix.com/docs/rest/business-solutions/e-commerce/catalog-service-plugin/handle-item-variants) in a way that meets your needs.
 *
 * The method's response must contain a `catalogItems` array. Each item in the array must contain:
 * + A `catalogReference` object. This must be identical to the `catalogReference` object received in the request.
 * + A `data` object with full details about the item.
 *
 * > **Notes:**
 * > + If an item doesn't exist in the catalog, the response must exclude it from the `catalogItems` array in the response.
 * > + When none of the items requested exist in the catalog, `catalogItems` must contain an empty array.
 * > + Wix calls the method every time a cart or checkout is updated. If the response doesn't include an item that was already in the cart or checkout, Wix removes the item from the cart or checkout.
 * > + Learn more about [implementing a Wix service plugin](https://dev.wix.com/docs/build-apps/develop-your-app/frameworks/self-hosting/supported-extensions/backend-extensions/add-self-hosted-service-plugin-extensions).
 * @param {import('interfaces-ecommerce-v1-catalog-provider').GetCatalogItemsOptions} options
 * @param {import('interfaces-ecommerce-v1-catalog-provider').Context} context
 * @returns {Promise<import('interfaces-ecommerce-v1-catalog-provider').GetCatalogItemsResponse | import('interfaces-ecommerce-v1-catalog-provider').BusinessError>}
 */

const APP_ID = "97ed05e3-04ed-4095-af45-90587bfed9f0";

export const getCatalogItems = async (options, context) => {
    const { catalogReferences } = options;
<<<<<<< HEAD
    //console.log("option", options);
    //console.log("catalog references", catalogReferences);
=======
console.log("option", options);
    console.log("catalog references", catalogReferences);
>>>>>>> d1edb2a (firing commit)

    return {
        options,
    }
};

function calculateCubicInches(productOptions) {
    console.log("product options", productOptions);
    const { Height, Width, Length } = productOptions;
    return Number(Height) * Number(Width) * Number(Length);
}