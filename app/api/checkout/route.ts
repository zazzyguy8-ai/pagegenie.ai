import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { businessName: string; description: string; plan?: "single" | "unlimited" };
    const { businessName, description, plan = "single" } = body;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const successUrl = `${appUrl}/?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${appUrl}/`;
    const meta       = { businessName: businessName.slice(0, 450), description: description.slice(0, 450) };

    let session;

    if (plan === "unlimited") {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          price_data: {
            currency:   "usd",
            product_data: {
              name:        "PageGenie Unlimited",
              description: "Generate and download unlimited websites every month",
            },
            unit_amount: 1900, // $19.00
            recurring:   { interval: "month" },
          },
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url:  cancelUrl,
        metadata:    meta,
      });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          price_data: {
            currency:   "usd",
            product_data: {
              name:        "PageGenie — Website Download",
              description: `Your website for: ${businessName}`,
            },
            unit_amount: 900, // $9.00
          },
          quantity: 1,
        }],
        success_url: successUrl,
        cancel_url:  cancelUrl,
        metadata:    meta,
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Checkout error:", msg);
    return NextResponse.json({ error: "Failed to create checkout", detail: msg }, { status: 500 });
  }
}
