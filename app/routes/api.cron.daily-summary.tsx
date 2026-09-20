import { ActionFunctionArgs } from "react-router";
import prisma from "../db.server";
import { Resend } from "resend";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 1. Authenticate the cron request
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Initialize Resend
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return new Response("RESEND_API_KEY is missing from environment variables", { status: 500 });
  }
  const resend = new Resend(resendApiKey);

  // 3. Find all shops with dailySummaryEmails enabled on the PRO plan
  const shops = await prisma.shopSettings.findMany({
    where: { dailySummaryEmails: true, planType: "PRO" },
  });

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let emailsSent = 0;

  // 4. For each shop, check if there are new exceptions
  for (const shopSetting of shops) {
    const shop = shopSetting.shop;

    const recentExceptions = await prisma.reconciliationException.findMany({
      where: {
        shop,
        createdAt: { gte: twentyFourHoursAgo },
      },
    });

    if (recentExceptions.length > 0) {
      // Find the merchant's email from the Session table
      let session = await prisma.session.findFirst({ where: { shop, accountOwner: true } });
      if (!session) {
        session = await prisma.session.findFirst({ where: { shop } });
      }

      const email = session?.email;
      if (!email) continue;

      // Send email
      try {
        await resend.emails.send({
          from: "onboarding@resend.dev", // Default testing email
          to: [email],
          subject: `Daily Reconciliation Summary - ${recentExceptions.length} New Discrepancies`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>DearRecon Daily Summary</h2>
              <p>Hello,</p>
              <p>Your background scanner has identified <strong>${recentExceptions.length}</strong> new reconciliation exceptions in the last 24 hours for <strong>${shop}</strong>.</p>
              <p>Please log in to your Shopify Admin and open the DearRecon app to review and resolve them.</p>
              <br/>
              <p>Thank you,<br/>The DearRecon Team</p>
            </div>
          `,
        });
        emailsSent++;
      } catch (e) {
        console.error(`Failed to send daily summary email to ${email} for shop ${shop}:`, e);
      }
    }
  }

  return new Response(JSON.stringify({ success: true, emailsSent }), {
    headers: { "Content-Type": "application/json" },
  });
};
