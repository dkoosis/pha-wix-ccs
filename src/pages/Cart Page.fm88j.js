import { conditionallyApplyMemberDiscount } from 'backend/member-discount.web';
import { refreshCart } from 'wix-ecom-frontend';

$w.onReady(async function () {
    //replaced with custom discount
    // const updatedCart = await conditionallyApplyMemberDiscount();
    // if (updatedCart) refreshCart();
});