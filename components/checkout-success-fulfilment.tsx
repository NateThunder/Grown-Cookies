"use client";

import { useEffect, useState } from "react";
import { BAKERY_COLLECTION_METHOD, formatDispatchDate } from "@/lib/dispatch";
import { getDispatchSelection } from "@/lib/dispatch-storage";
import type { CollectionSettings } from "@/lib/store-settings";

export default function CheckoutSuccessFulfilment({ collection }: { collection: CollectionSettings }) {
  const [date, setDate] = useState("");

  useEffect(() => {
    const selection = getDispatchSelection();
    if (selection?.method === BAKERY_COLLECTION_METHOD) {
      setDate(selection.scheduledDate);
    }
  }, []);

  if (!date) return null;

  return (
    <p>
      Collect on <strong>{formatDispatchDate(date)}</strong> between {collection.windowStart} and {collection.windowEnd} from {collection.venue}, {collection.addressLine1}, {collection.city}, {collection.postcode}.
    </p>
  );
}
