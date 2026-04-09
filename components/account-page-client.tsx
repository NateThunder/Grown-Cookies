"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { Session, User } from "@supabase/supabase-js";
import AccountSignupForm from "@/components/account-signup-form";
import type { AccountOrderItem, AccountOrderSummary } from "@/lib/account-orders";
import type { CustomerAddress, CustomerProfile } from "@/lib/customer-profiles";
import type { SavedPaymentMethod } from "@/lib/saved-payment-methods";
import { publicStripeAppearance } from "@/lib/stripe-appearance";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "@/app/account/page.module.css";

const dashboardNavItems = [
  { href: "#profile", label: "Profile" },
  { href: "#security", label: "Security" },
  { href: "#addresses", label: "Addresses" },
  { href: "#payments", label: "Payments" },
  { href: "#notifications", label: "Notifications" },
  { href: "#orders", label: "Order history" },
] as const;

type OrdersResponse = {
  orders?: AccountOrderSummary[];
  error?: string;
};

type ProfileResponse = {
  profile?: CustomerProfile;
  error?: string;
};

type AddressesResponse = {
  addresses?: CustomerAddress[];
  error?: string;
};

type PaymentMethodsResponse = {
  paymentMethods?: SavedPaymentMethod[];
  error?: string;
};

type SetupIntentResponse = {
  clientSecret?: string;
  error?: string;
};

type ProfileFormState = {
  firstName: string;
  lastName: string;
  phone: string;
  marketingOptIn: boolean;
};

type AddressFormState = {
  id?: number;
  label: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
  isDefault: boolean;
};

const emptyAddressForm: AddressFormState = {
  label: "",
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  country: "United Kingdom",
  phone: "",
  isDefault: true,
};

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function getDisplayName(user: User | null, profile: CustomerProfile | null) {
  const profileName = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();

  if (profileName) {
    return profileName;
  }

  if (!user) {
    return "Customer";
  }

  return (
    user.user_metadata?.full_name ||
    [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ") ||
    user.email ||
    "Customer"
  );
}

function getProviderLabel(user: User | null) {
  const provider = String(user?.app_metadata?.provider ?? "").toLowerCase();

  if (provider === "google") {
    return "Google";
  }

  if (provider === "email") {
    return "Email and password";
  }

  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "Account credentials";
}

function formatMoney(totalCents: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase() || "GBP",
  }).format(totalCents / 100);
}

function formatDate(dateText: string) {
  const parsed = new Date(dateText);

  if (Number.isNaN(parsed.getTime())) {
    return "Recent order";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getDeliverySummary(order: AccountOrderSummary) {
  return [
    order.fullName,
    order.addressLine1,
    order.addressLine2,
    order.city,
    order.postcode,
    order.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function getOrderItemSubtotal(item: AccountOrderItem) {
  if (item.lineTotalCents > 0) {
    return item.lineTotalCents;
  }

  return item.unitPriceCents * item.quantity;
}

function mapProfileToForm(profile: CustomerProfile, user: User | null): ProfileFormState {
  return {
    firstName: profile.firstName || String(user?.user_metadata?.first_name ?? ""),
    lastName: profile.lastName || String(user?.user_metadata?.last_name ?? ""),
    phone: profile.phone,
    marketingOptIn: profile.marketingOptIn,
  };
}

function mapAddressToForm(address: CustomerAddress): AddressFormState {
  return {
    id: address.id,
    label: address.label,
    firstName: address.firstName,
    lastName: address.lastName,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    postcode: address.postcode,
    country: address.country,
    phone: address.phone,
    isDefault: address.isDefault,
  };
}

function formatCardBrand(brand: string) {
  return brand
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripeErrorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

function AddPaymentMethodForm({
  clientSecret,
  onCancel,
  onSuccess,
}: {
  clientSecret: string;
  onCancel: () => void;
  onSuccess: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);
  const [hasPaymentMethodSelection, setHasPaymentMethodSelection] = useState(false);

  async function handleSubmit() {
    if (!stripe || !elements) {
      setErrorMessage("Payment form is still loading. Please wait.");
      return;
    }

    if (!isPaymentElementReady) {
      setErrorMessage("Payment form is still loading. Please wait.");
      return;
    }

    if (!hasPaymentMethodSelection) {
      setErrorMessage("Choose a payment method before saving it.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const submitResult = await elements.submit();
      if (submitResult.error) {
        throw new Error(stripeErrorText(submitResult.error));
      }

      const confirmationResult = await stripe.confirmSetup({
        clientSecret,
        elements,
        redirect: "if_required",
      });

      if (confirmationResult.error) {
        throw new Error(stripeErrorText(confirmationResult.error));
      }

      await onSuccess();
    } catch (error) {
      setErrorMessage(stripeErrorText(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.paymentSetupCard}>
      <div className={styles.paymentElementWrap}>
        <PaymentElement
          onReady={() => setIsPaymentElementReady(true)}
          onChange={(event) => setHasPaymentMethodSelection(Boolean(event.value.type))}
        />
      </div>
      {errorMessage ? <p className={styles.sectionStatus}>{errorMessage}</p> : null}
      <div className={styles.actionRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !isPaymentElementReady}
        >
          {isSubmitting ? "Saving..." : "Save payment method"}
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function AccountPageClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: "",
    lastName: "",
    phone: "",
    marketingOptIn: true,
  });
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressForm, setAddressForm] = useState<AddressFormState>(emptyAddressForm);
  const [addressMessage, setAddressMessage] = useState("");
  const [addressError, setAddressError] = useState("");
  const [isAddressSaving, setIsAddressSaving] = useState(false);
  const [isAddressDeletingId, setIsAddressDeletingId] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [paymentsError, setPaymentsError] = useState("");
  const [paymentsMessage, setPaymentsMessage] = useState("");
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false);
  const [isPaymentDeletingId, setIsPaymentDeletingId] = useState("");
  const [isAddingPaymentMethod, setIsAddingPaymentMethod] = useState(false);
  const [paymentSetupClientSecret, setPaymentSetupClientSecret] = useState("");
  const [paymentSetupError, setPaymentSetupError] = useState("");
  const [isPaymentSetupLoading, setIsPaymentSetupLoading] = useState(false);

  const [orders, setOrders] = useState<AccountOrderSummary[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isAddressesLoading, setIsAddressesLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setIsInitializing(false);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsSigningOut(false);
      setIsInitializing(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token ?? "";

    if (!accessToken || !user?.email) {
      setProfile(null);
      setProfileForm({
        firstName: String(user?.user_metadata?.first_name ?? ""),
        lastName: String(user?.user_metadata?.last_name ?? ""),
        phone: "",
        marketingOptIn: true,
      });
      setAddresses([]);
      setAddressForm(emptyAddressForm);
      setPaymentMethods([]);
      setOrders([]);
      setProfileError("");
      setAddressError("");
      setPaymentsError("");
      setOrdersError("");
      setProfileMessage("");
      setAddressMessage("");
      setPaymentsMessage("");
      setIsAddingPaymentMethod(false);
      setPaymentSetupClientSecret("");
      setPaymentSetupError("");
      setIsPaymentSetupLoading(false);
      setIsProfileLoading(false);
      setIsAddressesLoading(false);
      setIsPaymentsLoading(false);
      setIsOrdersLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    async function loadProfile() {
      setIsProfileLoading(true);
      setProfileError("");

      try {
        const response = await fetch("/api/account/profile", {
          headers,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as ProfileResponse;

        if (!response.ok || !payload.profile) {
          setProfile(null);
          setProfileError(payload.error || "We could not load your profile right now.");
          return;
        }

        setProfile(payload.profile);
        setProfileForm(mapProfileToForm(payload.profile, user));
      } catch {
        setProfile(null);
        setProfileError("We could not load your profile right now.");
      } finally {
        setIsProfileLoading(false);
      }
    }

    async function loadAddresses() {
      setIsAddressesLoading(true);
      setAddressError("");

      try {
        const response = await fetch("/api/account/addresses", {
          headers,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as AddressesResponse;

        if (!response.ok) {
          setAddresses([]);
          setAddressError(payload.error || "We could not load your saved addresses right now.");
          return;
        }

        const nextAddresses = Array.isArray(payload.addresses) ? payload.addresses : [];
        setAddresses(nextAddresses);
        setAddressForm((current) =>
          current.id
            ? current
            : {
                ...emptyAddressForm,
                isDefault: nextAddresses.length === 0,
              },
        );
      } catch {
        setAddresses([]);
        setAddressError("We could not load your saved addresses right now.");
      } finally {
        setIsAddressesLoading(false);
      }
    }

    async function loadOrders() {
      setIsOrdersLoading(true);
      setOrdersError("");

      try {
        const response = await fetch("/api/account/orders", {
          headers,
          cache: "no-store",
        });

        const payload = (await response.json().catch(() => ({}))) as OrdersResponse;

        if (!response.ok) {
          setOrders([]);
          setOrdersError(payload.error || "We could not load your order history right now.");
          return;
        }

        setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      } catch {
        setOrders([]);
        setOrdersError("We could not load your order history right now.");
      } finally {
        setIsOrdersLoading(false);
      }
    }

    async function loadPaymentMethods() {
      setIsPaymentsLoading(true);
      setPaymentsError("");

      try {
        const response = await fetch("/api/account/payment-methods", {
          headers,
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as PaymentMethodsResponse;

        if (!response.ok) {
          setPaymentMethods([]);
          setPaymentsError(payload.error || "We could not load your saved payment methods right now.");
          return;
        }

        setPaymentMethods(Array.isArray(payload.paymentMethods) ? payload.paymentMethods : []);
      } catch {
        setPaymentMethods([]);
        setPaymentsError("We could not load your saved payment methods right now.");
      } finally {
        setIsPaymentsLoading(false);
      }
    }

    void Promise.all([loadProfile(), loadAddresses(), loadPaymentMethods(), loadOrders()]);
  }, [session?.access_token, user, user?.email, user?.id]);

  const displayName = useMemo(() => getDisplayName(user, profile), [user, profile]);
  const providerLabel = useMemo(() => getProviderLabel(user), [user]);

  async function reloadPaymentMethods(accessToken: string) {
    const response = await fetch("/api/account/payment-methods", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as PaymentMethodsResponse;

    if (!response.ok) {
      throw new Error(payload.error || "We could not load your saved payment methods right now.");
    }

    const nextPaymentMethods = Array.isArray(payload.paymentMethods) ? payload.paymentMethods : [];
    setPaymentMethods(nextPaymentMethods);
    return nextPaymentMethods;
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    setIsSigningOut(true);
    await supabase.auth.signOut();
    setOrders([]);
  }

  async function handleProfileSave() {
    const accessToken = session?.access_token ?? "";

    if (!accessToken) {
      return;
    }

    setIsProfileSaving(true);
    setProfileMessage("");
    setProfileError("");

    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileForm),
      });

      const payload = (await response.json().catch(() => ({}))) as ProfileResponse;

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error || "We could not save your profile right now.");
      }

      setProfile(payload.profile);
      setProfileForm(mapProfileToForm(payload.profile, user));
      setProfileMessage("Profile saved.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "We could not save your profile right now.");
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handleAddressSave() {
    const accessToken = session?.access_token ?? "";

    if (!accessToken) {
      return;
    }

    setIsAddressSaving(true);
    setAddressMessage("");
    setAddressError("");

    try {
      const response = await fetch("/api/account/addresses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "upsert",
          address: addressForm,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AddressesResponse;

      if (!response.ok) {
        throw new Error(payload.error || "We could not save your address right now.");
      }

      const nextAddresses = Array.isArray(payload.addresses) ? payload.addresses : [];
      setAddresses(nextAddresses);
      setAddressForm({
        ...emptyAddressForm,
        isDefault: nextAddresses.length === 0,
      });
      setAddressMessage(addressForm.id ? "Address updated." : "Address saved.");
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "We could not save your address right now.");
    } finally {
      setIsAddressSaving(false);
    }
  }

  async function handleAddressDelete(addressId: number) {
    const accessToken = session?.access_token ?? "";

    if (!accessToken) {
      return;
    }

    setIsAddressDeletingId(addressId);
    setAddressMessage("");
    setAddressError("");

    try {
      const response = await fetch("/api/account/addresses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          addressId,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as AddressesResponse;

      if (!response.ok) {
        throw new Error(payload.error || "We could not delete your address right now.");
      }

      const nextAddresses = Array.isArray(payload.addresses) ? payload.addresses : [];
      setAddresses(nextAddresses);
      setAddressForm((current) =>
        current.id === addressId
          ? {
              ...emptyAddressForm,
              isDefault: nextAddresses.length === 0,
            }
          : current,
      );
      setAddressMessage("Address deleted.");
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "We could not delete your address right now.");
    } finally {
      setIsAddressDeletingId(null);
    }
  }

  async function handlePaymentMethodDelete(paymentMethodId: string) {
    const accessToken = session?.access_token ?? "";

    if (!accessToken) {
      return;
    }

    setIsPaymentDeletingId(paymentMethodId);
    setPaymentsMessage("");
    setPaymentsError("");

    try {
      const response = await fetch("/api/account/payment-methods", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "detach",
          paymentMethodId,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as PaymentMethodsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "We could not update your saved payment methods right now.");
      }

      setPaymentMethods(Array.isArray(payload.paymentMethods) ? payload.paymentMethods : []);
      setPaymentsMessage("Saved payment method removed.");
    } catch (error) {
      setPaymentsError(
        error instanceof Error
          ? error.message
          : "We could not update your saved payment methods right now.",
      );
    } finally {
      setIsPaymentDeletingId("");
    }
  }

  async function handleStartAddPaymentMethod() {
    const accessToken = session?.access_token ?? "";

    if (!accessToken) {
      return;
    }

    if (!stripePromise) {
      setPaymentSetupError("Stripe is not configured.");
      return;
    }

    setIsAddingPaymentMethod(true);
    setIsPaymentSetupLoading(true);
    setPaymentSetupError("");
    setPaymentsMessage("");

    try {
      const response = await fetch("/api/account/payment-methods/setup-intent", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as SetupIntentResponse;

      if (!response.ok || !payload.clientSecret) {
        throw new Error(payload.error || "We could not start payment method setup right now.");
      }

      setPaymentSetupClientSecret(payload.clientSecret);
    } catch (error) {
      setPaymentSetupClientSecret("");
      setPaymentSetupError(
        error instanceof Error ? error.message : "We could not start payment method setup right now.",
      );
    } finally {
      setIsPaymentSetupLoading(false);
    }
  }

  function handleCancelAddPaymentMethod() {
    setIsAddingPaymentMethod(false);
    setPaymentSetupClientSecret("");
    setPaymentSetupError("");
    setIsPaymentSetupLoading(false);
  }

  async function handlePaymentMethodAdded() {
    const accessToken = session?.access_token ?? "";

    if (!accessToken) {
      return;
    }

    await reloadPaymentMethods(accessToken);
    setIsAddingPaymentMethod(false);
    setPaymentSetupClientSecret("");
    setPaymentSetupError("");
    setPaymentsMessage("Payment method saved.");
  }

  if (isInitializing) {
    return (
      <section className={styles.accountLoading}>
        <div className={styles.loadingCard}>
          <p className={styles.panelEyebrow}>Account</p>
          <h1>Loading your account</h1>
          <p>Checking your sign-in status and preparing your dashboard.</p>
        </div>
      </section>
    );
  }

  if (!session || !user) {
    return (
      <section className={`${styles.hero} ${styles.authHero}`}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <p className={styles.panelEyebrow}>Account access</p>
              <h2>Register or sign in</h2>
              <p>Register or sign in with Supabase to access your Grown Cookies account.</p>
            </div>

            <AccountSignupForm />
          </div>
      </section>
    );
  }

  return (
    <section id="settings" className={styles.dashboard}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarCard}>
          <p className={styles.sidebarEyebrow}>My account</p>
          <h1>{displayName}</h1>
          <p>{user.email}</p>
        </div>

        <nav className={styles.sidebarNav} aria-label="Account sections">
          {dashboardNavItems.map((item) => (
            <a key={item.href} href={item.href} className={styles.sidebarLink}>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className={styles.dashboardContent}>
        <nav className={styles.mobileSectionNav} aria-label="Account sections">
          {dashboardNavItems.map((item) => (
            <a key={item.href} href={item.href} className={styles.mobileSectionLink}>
              {item.label}
            </a>
          ))}
        </nav>
        <section id="profile" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Profile</p>
            <h2>Your details</h2>
            <p>Manage the customer profile stored in your Grown Cookies account database.</p>
          </div>

          <div className={styles.settingsGrid}>
            <label className={styles.settingField}>
              <span>First name</span>
              <input
                type="text"
                value={profileForm.firstName}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))}
                placeholder="First name"
              />
            </label>
            <label className={styles.settingField}>
              <span>Last name</span>
              <input
                type="text"
                value={profileForm.lastName}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))}
                placeholder="Last name"
              />
            </label>
            <label className={styles.settingField}>
              <span>Email address</span>
              <input type="email" value={user.email ?? ""} placeholder="Email address" disabled />
            </label>
            <label className={styles.settingField}>
              <span>Phone number</span>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Add a phone number"
              />
            </label>
          </div>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={profileForm.marketingOptIn}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, marketingOptIn: event.target.checked }))
              }
            />
            <span>Receive launch updates, offers, and seasonal product news by email.</span>
          </label>

          {isProfileLoading ? <p className={styles.sectionStatus}>Loading your saved profile...</p> : null}
          {!isProfileLoading && profileError ? <p className={styles.sectionStatus}>{profileError}</p> : null}
          {!isProfileLoading && profileMessage ? <p className={styles.inlineNotice}>{profileMessage}</p> : null}

          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleProfileSave()}
              disabled={isProfileSaving}
            >
              {isProfileSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>

        <section id="security" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Security</p>
            <h2>Sign-in and account safety</h2>
            <p>Review how you sign in, keep access current, and log out from your account.</p>
          </div>

          <div className={styles.securityGrid}>
            <article className={styles.infoCard}>
              <h3>Sign-in method</h3>
              <p>{providerLabel}</p>
            </article>
            <article className={styles.infoCard}>
              <h3>Password</h3>
              <p>Use a strong password and rotate it regularly once password settings are enabled.</p>
            </article>
            <article className={styles.infoCard}>
              <h3>Current session</h3>
              <p>This browser session is active and authenticated for your Grown Cookies account.</p>
            </article>
          </div>

          <div className={styles.actionRow}>
            <button type="button" className={styles.secondaryButton}>
              Change password
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </section>

        <section id="addresses" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Addresses</p>
            <h2>Saved addresses</h2>
            <p>Save a delivery address here and reuse it during checkout.</p>
          </div>

          {isAddressesLoading ? <p className={styles.sectionStatus}>Loading your saved addresses...</p> : null}
          {!isAddressesLoading && addressError ? <p className={styles.sectionStatus}>{addressError}</p> : null}
          {!isAddressesLoading && addressMessage ? <p className={styles.inlineNotice}>{addressMessage}</p> : null}

          {addresses.length > 0 ? (
            <div className={styles.addressList}>
              {addresses.map((address) => (
                <article key={address.id} className={styles.addressCard}>
                  <div className={styles.addressCardTop}>
                    <div>
                      <h3>{address.label || (address.isDefault ? "Default address" : "Saved address")}</h3>
                      <p className={styles.addressMeta}>
                        {[address.firstName, address.lastName].filter(Boolean).join(" ")}
                      </p>
                    </div>
                    {address.isDefault ? <span className={styles.orderStatus}>Default</span> : null}
                  </div>
                  <p className={styles.addressMeta}>
                    {[address.addressLine1, address.addressLine2, address.city, address.postcode, address.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  {address.phone ? <p className={styles.addressMeta}>Phone: {address.phone}</p> : null}
                  <div className={styles.addressActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => {
                        setAddressForm(mapAddressToForm(address));
                        setAddressMessage("");
                        setAddressError("");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => void handleAddressDelete(address.id)}
                      disabled={isAddressDeletingId === address.id}
                    >
                      {isAddressDeletingId === address.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className={styles.settingsGrid}>
            <label className={styles.settingField}>
              <span>Label</span>
              <input
                type="text"
                value={addressForm.label}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="Home, office, gifting"
              />
            </label>
            <label className={styles.settingField}>
              <span>Phone number</span>
              <input
                type="tel"
                value={addressForm.phone}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Delivery contact number"
              />
            </label>
            <label className={styles.settingField}>
              <span>First name</span>
              <input
                type="text"
                value={addressForm.firstName}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, firstName: event.target.value }))}
                placeholder="First name"
              />
            </label>
            <label className={styles.settingField}>
              <span>Last name</span>
              <input
                type="text"
                value={addressForm.lastName}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, lastName: event.target.value }))}
                placeholder="Last name"
              />
            </label>
            <label className={styles.settingField}>
              <span>Address line 1</span>
              <input
                type="text"
                value={addressForm.addressLine1}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
                placeholder="Street address"
              />
            </label>
            <label className={styles.settingField}>
              <span>Address line 2</span>
              <input
                type="text"
                value={addressForm.addressLine2}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, addressLine2: event.target.value }))}
                placeholder="Flat, suite, or unit"
              />
            </label>
            <label className={styles.settingField}>
              <span>Town or city</span>
              <input
                type="text"
                value={addressForm.city}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="City"
              />
            </label>
            <label className={styles.settingField}>
              <span>Postcode</span>
              <input
                type="text"
                value={addressForm.postcode}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, postcode: event.target.value }))}
                placeholder="Postcode"
              />
            </label>
            <label className={styles.settingField}>
              <span>Country</span>
              <input
                type="text"
                value={addressForm.country}
                onChange={(event) => setAddressForm((prev) => ({ ...prev, country: event.target.value }))}
                placeholder="Country"
              />
            </label>
          </div>

          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={addressForm.isDefault}
              onChange={(event) => setAddressForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
            />
            <span>Use this as my default delivery address.</span>
          </label>

          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleAddressSave()}
              disabled={isAddressSaving}
            >
              {isAddressSaving ? "Saving..." : addressForm.id ? "Update address" : "Save address"}
            </button>
            {addressForm.id ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  setAddressForm({
                    ...emptyAddressForm,
                    isDefault: addresses.length === 0,
                  })
                }
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </section>

        <section id="payments" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Payments</p>
            <h2>Saved payment methods</h2>
            <p>Cards saved during checkout appear here for faster repeat purchases.</p>
          </div>

          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleStartAddPaymentMethod()}
              disabled={isPaymentSetupLoading}
            >
              {isPaymentSetupLoading ? "Loading..." : "Add payment method"}
            </button>
          </div>

          {isPaymentsLoading ? <p className={styles.sectionStatus}>Loading your saved payment methods...</p> : null}
          {!isPaymentsLoading && paymentsError ? <p className={styles.sectionStatus}>{paymentsError}</p> : null}
          {!isPaymentsLoading && paymentsMessage ? <p className={styles.inlineNotice}>{paymentsMessage}</p> : null}
          {paymentSetupError ? <p className={styles.sectionStatus}>{paymentSetupError}</p> : null}

          {isAddingPaymentMethod && paymentSetupClientSecret && stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret: paymentSetupClientSecret, appearance: publicStripeAppearance }}
            >
              <AddPaymentMethodForm
                clientSecret={paymentSetupClientSecret}
                onCancel={handleCancelAddPaymentMethod}
                onSuccess={handlePaymentMethodAdded}
              />
            </Elements>
          ) : null}

          {!isPaymentsLoading && !paymentsError && paymentMethods.length === 0 ? (
            <div className={styles.paymentEmptyState}>
              <h3>No saved payment methods</h3>
              <p>Add a card here or save one during checkout for faster future orders.</p>
            </div>
          ) : null}

          {paymentMethods.length > 0 ? (
            <div className={styles.addressList}>
              {paymentMethods.map((paymentMethod) => (
                <article key={paymentMethod.id} className={styles.addressCard}>
                  <div className={styles.addressCardTop}>
                    <div>
                      <h3>{formatCardBrand(paymentMethod.brand)} ending in {paymentMethod.last4}</h3>
                      <p className={styles.addressMeta}>
                        Expires {String(paymentMethod.expMonth).padStart(2, "0")}/{paymentMethod.expYear}
                      </p>
                    </div>
                  </div>
                  <div className={styles.addressActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => void handlePaymentMethodDelete(paymentMethod.id)}
                      disabled={isPaymentDeletingId === paymentMethod.id}
                    >
                      {isPaymentDeletingId === paymentMethod.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section id="notifications" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Notifications</p>
            <h2>Communication preferences</h2>
            <p>Marketing preference is persisted in your profile. Order updates remain enabled for purchases.</p>
          </div>

          <div className={styles.preferenceList}>
            <label className={styles.preferenceCard}>
              <div>
                <h3>Marketing emails</h3>
                <p>Saved from your profile preference and used for future account communication.</p>
              </div>
              <input type="checkbox" checked={profileForm.marketingOptIn} readOnly />
            </label>
            <label className={styles.preferenceCard}>
              <div>
                <h3>Order updates</h3>
                <p>Delivery and payment notifications remain tied to each order you place.</p>
              </div>
              <input type="checkbox" checked readOnly />
            </label>
            <label className={styles.preferenceCard}>
              <div>
                <h3>Restock alerts</h3>
                <p>This preference is not stored yet, but the account area is ready for it later.</p>
              </div>
              <input type="checkbox" readOnly />
            </label>
          </div>
        </section>

        <section id="orders" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Orders</p>
            <h2>Order history</h2>
          </div>

          {isOrdersLoading ? <p className={styles.ordersStatus}>Loading your order history...</p> : null}
          {!isOrdersLoading && ordersError ? <p className={styles.ordersStatus}>{ordersError}</p> : null}

          {!isOrdersLoading && !ordersError && orders.length === 0 ? (
            <div className={styles.emptyOrders}>
              <h3>No orders yet</h3>
              <p>Orders placed with {user.email} will appear here once checkout records are available.</p>
            </div>
          ) : null}

          {!isOrdersLoading && !ordersError && orders.length > 0 ? (
            <div className={styles.orderList}>
              {orders.map((order) => (
                <article key={order.orderId} className={styles.orderCard}>
                  <div className={styles.orderTopRow}>
                    <div>
                      <p className={styles.orderMetaLabel}>Order reference</p>
                      <h3>{order.orderId}</h3>
                    </div>
                    <span
                      className={`${styles.orderStatus} ${
                        styles[`status${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}`] || ""
                      }`.trim()}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className={styles.orderMetaGrid}>
                    <div>
                      <p className={styles.orderMetaLabel}>Placed</p>
                      <p>{formatDate(order.createdAt)}</p>
                    </div>
                    <div>
                      <p className={styles.orderMetaLabel}>Total</p>
                      <p>{formatMoney(order.totalCents, order.currency)}</p>
                    </div>
                  </div>

                  {order.items.length > 0 ? (
                    <div className={styles.orderItems}>
                      {order.items.map((item, index) => (
                        <div key={`${order.orderId}-${item.slug || item.name}-${index}`} className={styles.orderItem}>
                          <div className={styles.orderItemImageFrame}>
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.imageAlt || item.name}
                                fill
                                sizes="72px"
                                className={styles.orderItemImage}
                              />
                            ) : (
                              <div className={styles.orderItemImageFallback} aria-hidden="true">
                                {item.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className={styles.orderItemBody}>
                            <div>
                              <p className={styles.orderItemName}>{item.name}</p>
                              <p className={styles.orderItemMeta}>
                                Qty {item.quantity}
                                {item.unitPriceCents > 0
                                  ? ` · ${formatMoney(item.unitPriceCents, order.currency)} each`
                                  : ""}
                              </p>
                            </div>
                            <p className={styles.orderItemTotal}>
                              {formatMoney(getOrderItemSubtotal(item), order.currency)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.orderDelivery}>
                    <p className={styles.orderMetaLabel}>Delivery</p>
                    <p>{getDeliverySummary(order) || "Delivery details unavailable"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}
