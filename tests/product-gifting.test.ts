import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStoredBasketItems } from "../lib/basket.ts";
import { buildCheckoutQuote } from "../lib/checkout-quote.ts";

test("normalizeStoredBasketItems drops No gift metadata", () => {
  const items = normalizeStoredBasketItems([
    {
      lineId: "plain",
      slug: "double-chocolate-hazelnut",
      quantity: 1,
      gifting: {
        cardId: "none",
        message: "Not stored",
      },
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].gifting, undefined);
});

test("notecard gifting stores paid gift details", async () => {
  const quote = await buildCheckoutQuote({
    items: [
      {
        lineId: "notecard-line",
        slug: "double-chocolate-hazelnut",
        quantity: 1,
        gifting: {
          cardId: "notecard",
          message: "Enjoy these.",
        },
      },
    ],
    tip: { mode: "none" },
  });

  assert.equal(quote.lines.length, 1);
  assert.equal(quote.lines[0].lineTotalCents, 2550);
  assert.deepEqual(quote.lines[0].gifting, {
    cardId: "notecard",
    cardLabel: "Notecard",
    cardPriceCents: 350,
    message: "Enjoy these.",
  });
});

test("notecard is charged once per gifted basket line", async () => {
  const quote = await buildCheckoutQuote({
    items: [
      {
        lineId: "notecard-line",
        slug: "double-chocolate-hazelnut",
        quantity: 3,
        gifting: {
          cardId: "notecard",
          message: "For you.",
        },
      },
    ],
    tip: { mode: "none" },
  });

  assert.equal(quote.lines.length, 1);
  assert.equal(quote.lines[0].unitPriceCents, 2200);
  assert.equal(quote.lines[0].lineTotalCents, 6950);
  assert.equal(quote.subtotalCents, 6950);
  assert.equal(quote.lines[0].gifting?.cardPriceCents, 350);
});

test("gifted duplicate products remain separate quote lines", async () => {
  const quote = await buildCheckoutQuote({
    items: [
      {
        lineId: "gifted-one",
        slug: "double-chocolate-hazelnut",
        quantity: 1,
        gifting: {
          cardId: "notecard",
          message: "First message",
        },
      },
      {
        lineId: "gifted-two",
        slug: "double-chocolate-hazelnut",
        quantity: 1,
        gifting: {
          cardId: "notecard",
          message: "Second message",
        },
      },
    ],
    tip: { mode: "none" },
  });

  assert.equal(quote.lines.length, 2);
  assert.deepEqual(
    quote.lines.map((line) => line.lineId),
    ["gifted-one", "gifted-two"],
  );
});

test("digital gift-card products reject physical gifting metadata", async () => {
  await assert.rejects(
    () =>
      buildCheckoutQuote({
        items: [
          {
            lineId: "gift-card-line",
            slug: "gift-card",
            quantity: 1,
            giftCardAmountCents: 1000,
            gifting: {
              cardId: "notecard",
              message: "Should not be accepted.",
            },
          },
        ],
        tip: { mode: "none" },
      }),
    /Gift options are only valid for cookie products/,
  );
});
