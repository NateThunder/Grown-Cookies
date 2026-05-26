import { NextResponse } from "next/server";
import {
  buildCheckoutQuote,
  parseQuoteDispatch,
  parseQuoteGiftCardCodes,
  parseQuoteItems,
  parseQuoteTip,
} from "@/lib/checkout-quote";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: unknown;
      tip?: unknown;
      dispatch?: unknown;
      giftCardCodes?: unknown;
    };

    const quote = await buildCheckoutQuote({
      items: parseQuoteItems(body.items),
      tip: parseQuoteTip(body.tip),
      dispatch: parseQuoteDispatch(body.dispatch),
      giftCardCodes: parseQuoteGiftCardCodes(body.giftCardCodes),
    });

    return NextResponse.json(quote);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not calculate basket totals.",
      },
      { status: 400 },
    );
  }
}
