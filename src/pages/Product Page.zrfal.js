// Velo API Reference: https://www.wix.com/velo/reference/api-overview/introduction
import wixLocation from 'wix-location';
$w.onReady(async function () {
    const product = await $w('#productPage1').getProduct()
    if (product._id == "c8539b66-7a44-fe18-affc-afec4be8562a") {
        wixLocation.to("/firing")
    } else {
        $w('#section4').show()
    }
});