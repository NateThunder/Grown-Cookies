import AdminLoginScreen from "@/components/admin-login-screen";
import AdminShell, { AdminD1RequiredState } from "@/components/admin-shell";
import { getMailingListSubscribers } from "@/lib/mailing-list";
import { deleteMailingListSubscriberAction } from "../actions";
import { getAdminPageContext } from "../admin-page-context";
import { formatAdminDate, type SearchParamValue } from "../admin-ui";
import styles from "../page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MailingListAdminPageProps = {
  searchParams: Promise<Record<string, SearchParamValue>>;
};

const MAILING_LIST_RETURN_PATH = "/admin/mailing-list";

export default async function MailingListAdminPage({
  searchParams,
}: MailingListAdminPageProps) {
  const context = await getAdminPageContext(searchParams);

  if (!context.adminUser) {
    return (
      <AdminLoginScreen
        title="Sign in to view the mailing list"
        returnPath={MAILING_LIST_RETURN_PATH}
        error={context.flash.error}
        warning={context.flash.warning}
        supabaseConfigured={context.supabaseConfigured}
      />
    );
  }

  const subscribers = context.d1Configured ? await getMailingListSubscribers() : [];

  return (
    <AdminShell
      eyebrow="Customers"
      title="Mailing list"
      description="View the email addresses currently subscribed through the storefront mailing-list form."
      returnPath={MAILING_LIST_RETURN_PATH}
      flash={context.flash}
      metrics={
        <div className={styles.metricCard}>
          <span>Subscribers</span>
          <strong>{subscribers.length}</strong>
        </div>
      }
    >
      {!context.d1Configured ? (
        <AdminD1RequiredState />
      ) : (
        <section className={styles.workspace}>
          <div className={styles.workspaceStack}>
            <section className={styles.tablePanel}>
              <div className={styles.tablePanelHeader}>
                <div>
                  <p className={styles.tableEyebrow}>Mailing list</p>
                  <h2>Email addresses</h2>
                </div>
                <p className={styles.tableHint}>
                  The list box shows 10 rows at a time and scrolls for the remaining subscribers.
                </p>
              </div>

              {subscribers.length === 0 ? (
                <div className={styles.ordersEmptyState}>
                  <h3>No subscribers yet</h3>
                  <p>Email addresses will appear here after visitors join the mailing list.</p>
                </div>
              ) : (
                <div className={`${styles.tableScroll} ${styles.mailingListScroll}`.trim()}>
                  <table className={`${styles.table} ${styles.mailingListTable}`.trim()}>
                    <thead>
                      <tr>
                        <th scope="col">Email address</th>
                        <th scope="col">Source</th>
                        <th scope="col">Subscribed</th>
                        <th scope="col" className={styles.actionsColumn}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscribers.map((subscriber) => (
                        <tr key={subscriber.id}>
                          <td>
                            <strong>{subscriber.email}</strong>
                          </td>
                          <td>{subscriber.source}</td>
                          <td>{formatAdminDate(subscriber.subscribedAt)}</td>
                          <td className={styles.actionsColumn}>
                            <form
                              action={deleteMailingListSubscriberAction}
                              className={styles.mailingListDeleteForm}
                            >
                              <input type="hidden" name="subscriberId" value={subscriber.id} />
                              <input
                                type="hidden"
                                name="returnPath"
                                value={MAILING_LIST_RETURN_PATH}
                              />
                              <button
                                type="submit"
                                className={styles.mailingListDeleteButton}
                                aria-label={`Delete ${subscriber.email} from the mailing list`}
                              >
                                Delete
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </section>
      )}
    </AdminShell>
  );
}
