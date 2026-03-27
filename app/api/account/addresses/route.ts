import { NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/account-auth";
import {
  deleteCustomerAddressForUser,
  listCustomerAddressesForUser,
  upsertCustomerAddressForUser,
  type UpsertCustomerAddressInput,
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

function parseInteger(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseUpsertInput(raw: unknown): UpsertCustomerAddressInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Address details are invalid.");
  }

  const address = raw as {
    id?: unknown;
    label?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    addressLine1?: unknown;
    addressLine2?: unknown;
    city?: unknown;
    postcode?: unknown;
    country?: unknown;
    phone?: unknown;
    isDefault?: unknown;
  };

  const input: UpsertCustomerAddressInput = {
    firstName: normalizeText(address.firstName),
    lastName: normalizeText(address.lastName),
    addressLine1: normalizeText(address.addressLine1),
    addressLine2: normalizeText(address.addressLine2),
    city: normalizeText(address.city),
    postcode: normalizeText(address.postcode),
    country: normalizeText(address.country),
    phone: normalizeText(address.phone),
    label: normalizeText(address.label),
    isDefault: parseBoolean(address.isDefault),
  };

  const id = parseInteger(address.id);
  if (id > 0) {
    input.id = id;
  }

  if (!input.addressLine1 || !input.city || !input.postcode || !input.country) {
    throw new Error("Complete the required address fields.");
  }

  return input;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const addresses = await listCustomerAddressesForUser(user);
    return NextResponse.json({ addresses });
  } catch {
    return NextResponse.json(
      { error: "We could not load your saved addresses right now." },
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
    const body = (await request.json()) as {
      action?: unknown;
      address?: unknown;
      addressId?: unknown;
    };

    const action = normalizeText(body.action).toLowerCase();

    if (action === "delete") {
      const addressId = parseInteger(body.addressId);

      if (addressId <= 0) {
        throw new Error("Saved address not found.");
      }

      const addresses = await deleteCustomerAddressForUser(user, addressId);
      return NextResponse.json({ addresses });
    }

    const addresses = await upsertCustomerAddressForUser(user, parseUpsertInput(body.address));
    return NextResponse.json({ addresses });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "We could not save your address right now.",
      },
      { status: 400 },
    );
  }
}
