import assert from "node:assert/strict";
import test from "node:test";
import type { BasketQuoteLine } from "../lib/basket.ts";
import { sanitizeOrderJourney } from "../lib/order-journey.ts";

const purchasedLines = [
  { slug: "red-velvet", name: "Red Velvet Cookie" },
] as BasketQuoteLine[];

test("order journey keeps allow-listed milestones and purchased products only", () => {
  const journey = sanitizeOrderJourney(
    {
      consent: "accepted",
      dayKey: "2026-08-07",
      events: [
        { type: "source", label: "Instagram", occurredAt: "2026-08-07T09:00:00.000Z" },
        { type: "shop", label: "Tampered label", occurredAt: "2026-08-07T09:01:00.000Z" },
        {
          type: "product_added",
          label: "Tampered product",
          productSlug: "red-velvet",
          occurredAt: "2026-08-07T09:02:00.000Z",
        },
        {
          type: "product_added",
          label: "Removed product",
          productSlug: "removed-cookie",
          occurredAt: "2026-08-07T09:03:00.000Z",
        },
        { type: "arbitrary_page", label: "Account", occurredAt: "2026-08-07T09:04:00.000Z" },
      ],
    },
    purchasedLines,
  );

  assert.deepEqual(
    journey?.events?.map((event) => event.label),
    ["Instagram", "Shop", "Added Red Velvet Cookie"],
  );
});

test("order journey collapses repeated milestones", () => {
  const journey = sanitizeOrderJourney(
    {
      consent: "accepted",
      dayKey: "2026-08-07",
      events: [
        { type: "shop", label: "Shop", occurredAt: "2026-08-07T09:00:00.000Z" },
        { type: "shop", label: "Shop", occurredAt: "2026-08-07T10:00:00.000Z" },
      ],
    },
    purchasedLines,
  );

  assert.equal(journey?.events?.length, 1);
});

test("denied consent stores no journey events", () => {
  assert.deepEqual(
    sanitizeOrderJourney(
      {
        consent: "denied",
        events: [{ type: "source", label: "Instagram", occurredAt: "2026-08-07T09:00:00.000Z" }],
      },
      purchasedLines,
    ),
    { consent: "denied" },
  );
});
