import assert from "node:assert/strict";
import test from "node:test";
import { buildCheckoutQuote } from "../lib/checkout-quote.ts";
import {
  BAKERY_COLLECTION_METHOD,
  UK_POSTAL_SHIPPING_METHOD,
  parseDispatchSelection,
} from "../lib/dispatch.ts";

const physicalItems = [
  { lineId: "cookies", slug: "double-chocolate-hazelnut", quantity: 1 },
];

test("physical orders remain delivery by default", async () => {
  const quote = await buildCheckoutQuote({ items: physicalItems, tip: { mode: "none" } });
  assert.equal(quote.fulfilmentMethod, UK_POSTAL_SHIPPING_METHOD);
  assert.equal(quote.shippingCents, 1000);
  assert.equal(quote.collection, null);
});

test("bakery collection is free and returns server-owned pickup details", async () => {
  const quote = await buildCheckoutQuote({
    items: physicalItems,
    tip: { mode: "none" },
    dispatch: { method: BAKERY_COLLECTION_METHOD, scheduledDate: "" },
  });
  assert.equal(quote.fulfilmentMethod, BAKERY_COLLECTION_METHOD);
  assert.equal(quote.shippingCents, 0);
  assert.deepEqual(quote.collection, {
    venue: "Akara Bakery",
    addressLine1: "537 Duke Street",
    city: "Glasgow",
    postcode: "G31 1DL",
    windowStart: "12:00",
    windowEnd: "15:00",
  });
});

test("legacy dispatch storage parses as the canonical scheduled date", () => {
  assert.deepEqual(
    parseDispatchSelection({ method: UK_POSTAL_SHIPPING_METHOD, dispatchDate: "2027-01-05" }),
    { method: UK_POSTAL_SHIPPING_METHOD, scheduledDate: "2027-01-05" },
  );
});

test("forged fulfilment methods are rejected", () => {
  assert.equal(parseDispatchSelection({ method: "free_collection", scheduledDate: "2027-01-05" }), null);
});
