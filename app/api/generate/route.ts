import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STYLE_PROMPTS: Record<string, string> = {
  minimal: "Clean minimal design: white background, lots of whitespace, black/gray text, subtle borders, Inter or system font, very modern and elegant.",
  bold: "Bold dark design: near-black background (#0f0f0f), vibrant gradient accent (purple to blue), large bold headlines, high contrast, energetic feel.",
  pro: "Professional corporate design: navy/dark-blue (#1e3a5f) header and accents, white body, trust-building layout, clean sans-serif, suitable for B2B or services.",
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as { businessName: string; description: string; style: string; sessionId?: string };
    const { businessName, description, style, sessionId } = body;

    if (!businessName || !description) {
      return NextResponse.json({ error: "businessName and description required" }, { status: 400 });
    }

    // Verify Stripe payment if sessionId provided
    if (sessionId) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Payment verification unavailable" }, { status: 500 });
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
      }
    }

    const styleGuide = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.minimal;

    const prompt = `You are an expert web designer. Create a complete, beautiful, production-ready single-page website as a single HTML file.

BUSINESS:
Name: ${businessName}
Description: ${description}

DESIGN STYLE: ${styleGuide}

REQUIREMENTS:
- Single HTML file with everything inline (CSS in <style> tag, no external dependencies except Google Fonts via @import)
- Modern, professional landing page with these sections:
  1. Hero: bold headline, sub-headline, primary CTA button
  2. Features/Services: 3 key offerings in a grid
  3. About/Trust: short compelling paragraph + 2-3 trust signals (years, clients, etc.)
  4. Contact/CTA: final call-to-action section
- Fully responsive (mobile-first with media queries)
- Smooth scroll, hover effects on buttons/cards
- Real, specific copy tailored to the business description (not placeholder text)
- DO NOT use Lorem Ipsum — write real copy based on the business info

Return ONLY the complete HTML starting with <!DOCTYPE html>. No markdown, no explanation.`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    });

    const html = message.content[0].type === "text" ? message.content[0].text.trim() : "";

    if (!html.startsWith("<!DOCTYPE") && !html.startsWith("<html")) {
      return NextResponse.json({ error: "Generation failed — please try again" }, { status: 500 });
    }

    return NextResponse.json({ html });
  } catch (err) {
    console.error("Generate error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
