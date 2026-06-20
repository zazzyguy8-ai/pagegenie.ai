import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ paid: false });

  try {
    const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const complete = session.status === "complete";
    if (!complete) return NextResponse.json({ paid: false });

    if (session.mode === "subscription") {
      return NextResponse.json({
        paid:           true,
        type:           "subscription",
        subscriptionId: session.subscription as string | undefined,
      });
    }

    return NextResponse.json({ paid: true, type: "single" });
  } catch {
    return NextResponse.json({ paid: false });
  }
}
