import * as ecomValidations from 'interfaces-ecommerce-v1-validations-provider';

/** @returns {import('interfaces-ecommerce-v1-validations-provider').ValidationsSPIConfig} */
export function getConfig() {
    return { validateInCart: true };
}