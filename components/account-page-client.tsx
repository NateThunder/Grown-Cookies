"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import AccountSignupForm from "@/components/account-signup-form";
import type { AccountOrderSummary } from "@/lib/account-orders";
import type { CustomerAddress, CustomerProfile } from "@/lib/customer-profiles";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "@/app/account/page.module.css";

const perks = [
  "Save your details for faster checkout next time.",
  "Track upcoming orders and seasonal drops in one place.",
  "Get early access to limited-edition cookie launches.",
];

const dashboardNavItems = [
  { href: "#profile", label: "Profile" },
  { href: "#security", label: "Security" },
  { href: "#addresses", label: "Addresses" },
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
      setOrders([]);
      setProfileError("");
      setAddressError("");
      setOrdersError("");
      setProfileMessage("");
      setAddressMessage("");
      setIsProfileLoading(false);
      setIsAddressesLoading(false);
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

    void Promise.all([loadProfile(), loadAddresses(), loadOrders()]);
  }, [session?.access_token, user, user?.email, user?.id]);

  const displayName = useMemo(() => getDisplayName(user, profile), [user, profile]);
  const providerLabel = useMemo(() => getProviderLabel(user), [user]);

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
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Customer accounts</p>
          <h1>Create your Grown Cookies account</h1>
          <p className={styles.description}>
            Register once to make reordering simpler and give customers a clear
            home for future order history, exclusives, and updates.
          </p>

          <ul className={styles.perks}>
            {perks.map((perk) => (
              <li key={perk}>{perk}</li>
            ))}
          </ul>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <p className={styles.panelEyebrow}>Account access</p>
            <h2>Register or sign in</h2>
            <p>
              This uses Supabase Auth. Customers can create an account, return
              to sign in with email and password, or continue with Google.
            </p>
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
            <p>Store a preferred delivery address in D1 and reuse it for future orders.</p>
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
              {isAddressSaving ? "Saving..." : addressForm.id ? "Update address" : "Add address"}
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
            <p>Your checkout records are linked to this account by Supabase user ID with email backfill for older orders.</p>
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
