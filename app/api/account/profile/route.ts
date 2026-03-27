import { NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import {
  getCustomerProfileForUser,
  updateCustomerProfileForUser,
  type UpdateCustomerProfileInput,
} from "@/lib/customer-profiles";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function parseProfileInput(raw: unknown): UpdateCustomerProfileInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Profile details are invalid.");
  }

  return {
    firstName: normalizeText((raw as { firstName?: unknown }).firstName),
    lastName: normalizeText((raw as { lastName?: unknown }).lastName),
    phone: normalizeText((raw as { phone?: unknown }).phone),
    marketingOptIn: parseBoolean((raw as { marketingOptIn?: unknown }).marketingOptIn, true),
  };
}

export async function GET(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profile = await getCustomerProfileForUser(user);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json(
      { error: "We could not load your profile right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const profile = await updateCustomerProfileForUser(user, parseProfileInput(body));
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "We could not save your profile right now.",
      },
      { status: 400 },
    );
  }
}
