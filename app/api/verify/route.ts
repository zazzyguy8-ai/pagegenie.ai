import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ paid: false });

  try {
    const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({ paid: session.payment_status === "paid" });
  } catch {
    return NextResponse.json({ paid: false });
  }
}
