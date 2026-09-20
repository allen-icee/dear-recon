import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>DearRecon</h1>
        <p className={styles.text}>
          Automated inventory reconciliation for Shopify refunds.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Automated Real-Time Auditing</strong>. Background webhooks catch missing returns the second a refund is issued.
          </li>
          <li>
            <strong>Financial Exposure Tracking</strong>. Instantly see the exact dollar amount of un-restocked inventory at risk.
          </li>
          <li>
            <strong>One-Click Resolution</strong>. Mark discrepancies as resolved, write off losses, or clear historical items natively.
          </li>
        </ul>
      </div>
    </div>
  );
}
