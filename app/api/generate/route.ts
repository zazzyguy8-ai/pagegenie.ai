import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STYLE_PROMPTS: Record<string, string> = {
  minimal: `Design: clean modern minimal. White (#ffffff) background, dark gray (#111) text, indigo (#6366f1) accent color. Lots of whitespace. System font stack. Very elegant.`,
  bold: `Design: bold energetic. Very dark background (#0d0d0d), white text, bright purple-to-blue gradient (#7c3aed to #2563eb) for buttons and accents. Large typography. High contrast.`,
  pro: `Design: professional corporate. White background, dark navy (#1e3a5f) header and accents, gray body text. Clean, trustworthy, business-focused.`,
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as { businessName: string; description: string; style: string; sessionId?: string };
    const { businessName, description, style, sessionId } = body;

    if (!businessName || !description) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // Verify Stripe payment if sessionId provided
    if (sessionId) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ error: "Payment not completed" }), { status: 402 });
      }
    }

    const styleGuide = STYLE_PROMPTS[style] ?? STYLE_PROMPTS.minimal;

    const prompt = `You are an expert web designer. Create a complete, beautiful, working single-page website as ONE HTML file.

BUSINESS NAME: ${businessName}
BUSINESS DESCRIPTION: ${description}
${styleGuide}

RULES:
- Output ONLY the raw HTML. Start immediately with <!DOCTYPE html>. No explanation, no markdown.
- All CSS must be in a <style> tag in the <head>. No external CSS files.
- Use Google Fonts via: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
- Use Inter font everywhere: body { font-family: 'Inter', system-ui, sans-serif; }
- Sections to include:
  1. Sticky nav with logo/name + 1 CTA button
  2. Hero: big headline (based on the business), sub-headline, 2 CTA buttons
  3. Services/Features: 3 cards in a responsive grid
  4. About: short paragraph + 3 stats/trust signals
  5. Contact/CTA section: headline + email input + button
  6. Footer
- Fully responsive with media queries for mobile
- Smooth scroll behavior
- Hover effects on buttons and cards
- Write REAL copy based on the business — NO placeholder text, NO Lorem Ipsum
- All colors must have good contrast — text must always be clearly readable
- The page must look visually complete and professional when opened in any browser`;

    // Stream the response
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("Generate error:", err);
    return new Response(JSON.stringify({ error: "Generation failed" }), { status: 500 });
  }
}
