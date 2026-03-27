import { NextResponse } from "next/server";
import { buildCheckoutQuote, parseQuoteItems, parseQuoteTip } from "@/lib/checkout-quote";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: unknown;
      tip?: unknown;
    };

    const quote = await buildCheckoutQuote({
      items: parseQuoteItems(body.items),
      tip: parseQuoteTip(body.tip),
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
