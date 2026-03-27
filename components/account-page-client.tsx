"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import AccountSignupForm from "@/components/account-signup-form";
import type { AccountOrderSummary } from "@/lib/account-orders";
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

function getDisplayName(user: User | null) {
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

export default function AccountPageClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [orders, setOrders] = useState<AccountOrderSummary[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
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
    async function loadOrders(accessToken: string) {
      setIsOrdersLoading(true);
      setOrdersError("");

      try {
        const response = await fetch("/api/account/orders", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
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

    const accessToken = session?.access_token ?? "";

    if (!accessToken || !user?.email) {
      setOrders([]);
      setOrdersError("");
      setIsOrdersLoading(false);
      return;
    }

    void loadOrders(accessToken);
  }, [session?.access_token, user?.email]);

  const displayName = useMemo(() => getDisplayName(user), [user]);
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
            <p>These fields are laid out for a standard customer settings page and can be made editable later.</p>
          </div>

          <div className={styles.settingsGrid}>
            <label className={styles.settingField}>
              <span>First name</span>
              <input
                type="text"
                defaultValue={String(user.user_metadata?.first_name ?? "")}
                placeholder="First name"
              />
            </label>
            <label className={styles.settingField}>
              <span>Last name</span>
              <input
                type="text"
                defaultValue={String(user.user_metadata?.last_name ?? "")}
                placeholder="Last name"
              />
            </label>
            <label className={styles.settingField}>
              <span>Email address</span>
              <input type="email" defaultValue={user.email ?? ""} placeholder="Email address" />
            </label>
            <label className={styles.settingField}>
              <span>Phone number</span>
              <input type="tel" placeholder="Add a phone number" />
            </label>
          </div>

          <div className={styles.placeholderRow}>
            <button type="button" className={styles.secondaryButton}>
              Save changes
            </button>
            <p>Profile editing is styled for the final settings flow and intentionally non-persistent in this version.</p>
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
            <p>Add a preferred delivery address layout now; persistence can be connected later.</p>
          </div>

          <div className={styles.settingsGrid}>
            <label className={styles.settingField}>
              <span>Address line 1</span>
              <input type="text" placeholder="Street address" />
            </label>
            <label className={styles.settingField}>
              <span>Address line 2</span>
              <input type="text" placeholder="Flat, suite, or unit" />
            </label>
            <label className={styles.settingField}>
              <span>Town or city</span>
              <input type="text" placeholder="City" />
            </label>
            <label className={styles.settingField}>
              <span>Postcode</span>
              <input type="text" placeholder="Postcode" />
            </label>
            <label className={styles.settingField}>
              <span>Country</span>
              <input type="text" placeholder="Country" />
            </label>
          </div>

          <div className={styles.placeholderRow}>
            <button type="button" className={styles.secondaryButton}>
              Add address
            </button>
            <p>Address storage is not connected yet, but the section is structured like a standard customer account page.</p>
          </div>
        </section>

        <section id="notifications" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Notifications</p>
            <h2>Communication preferences</h2>
            <p>Typical customer notification controls are included here as a presentational first pass.</p>
          </div>

          <div className={styles.preferenceList}>
            <label className={styles.preferenceCard}>
              <div>
                <h3>Marketing emails</h3>
                <p>Receive launch updates, limited drops, and seasonal promotions.</p>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
            <label className={styles.preferenceCard}>
              <div>
                <h3>Order updates</h3>
                <p>Keep delivery and payment notifications enabled for your purchases.</p>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
            <label className={styles.preferenceCard}>
              <div>
                <h3>Restock alerts</h3>
                <p>Get notified when favourite items or limited flavours return.</p>
              </div>
              <input type="checkbox" />
            </label>
          </div>
        </section>

        <section id="orders" className={styles.dashboardSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Orders</p>
            <h2>Order history</h2>
            <p>Your past checkout records are matched to this account by email address.</p>
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
