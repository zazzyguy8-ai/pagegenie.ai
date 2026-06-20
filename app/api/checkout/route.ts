import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { businessName: string; description: string; style: string };
    const { businessName, description, style } = body;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "PageGenie — AI Website Generation",
              description: `Website for: ${businessName}`,
            },
            unit_amount: 200, // $2.00
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
      metadata: {
        businessName: businessName.slice(0, 450),
        description: description.slice(0, 450),
        style,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Checkout error:", msg);
    return NextResponse.json({ error: "Failed to create checkout", detail: msg }, { status: 500 });
  }
}
