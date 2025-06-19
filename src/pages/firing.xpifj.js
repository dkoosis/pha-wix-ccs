/*
 * This code gets called when the user clicks the Submit Worksheet button on the
 * Custom Element "firing worksheet"
 * The code fetches the worksheet data and adds each row as a lineitem.
 *
 * We pursued a different, more elegant, approach using addToCurrentCart() (see file xxx)
 * but hit a wall and reverted to this approach using a custom catalog.
 * The obstacle had to do with not having an active cart at the time of
 * calling addToCurrentCart()
 *
 * TODO: figure out the approach using addToCurrentCart()
 */
import {
  refreshCart,
  openSideCart,
  navigateToCartPage,
} from "wix-ecom-frontend";
import { currentCart } from "wix-ecom-backend";
import { addWorksheetToCart } from "backend/firing-worksheet.web.js";

$w.onReady(function () {
  $w("#worksheetElement").on("submitWorksheet", async (event) => {
    try {
      console.log("event", event);
      const revisedEvent = event.detail.data.map((item) => {
        let img =
          "wix:image://v1/4df3a3_fae918872a294e8b8e64dbbd4e82e12c~mv2.png/firing.png#originWidth=1000&originHeight=1000";
        if (item.photoBuffer) {
          img = item.photoBuffer;
        }
        return {
          ...item,
          photoBuffer: img,
        };
      });
      $w("#worksheetElement").setAttribute("loader", "show");
      const cart = await currentCart.getCurrentCart();
      const updatedCart = await addWorksheetToCart(revisedEvent);
      console.log("update", updatedCart, revisedEvent);
      $w("#worksheetElement").setAttribute("loader", "hide");
      await refreshCart();
      await navigateToCartPage();
    } catch (error) {
      console.log("error", error);
      const temp = await addWorksheetToCart(event.detail.data);
      $w("#worksheetElement").setAttribute("loader", "hide");
      await refreshCart();
      await navigateToCartPage();
    }
  });
});
>>>>>>> d1edb2a (firing commit)
