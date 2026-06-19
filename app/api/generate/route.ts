import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const COLOR_MAP: Record<string, { hex: string; name: string }> = {
  violet:  { hex: "#7C3AED", name: "violet"  },
  blue:    { hex: "#2563EB", name: "blue"     },
  cyan:    { hex: "#0891B2", name: "cyan"     },
  green:   { hex: "#059669", name: "green"    },
  lime:    { hex: "#65A30D", name: "lime"     },
  orange:  { hex: "#EA580C", name: "orange"   },
  red:     { hex: "#DC2626", name: "red"      },
  pink:    { hex: "#DB2777", name: "pink"     },
  rose:    { hex: "#E11D48", name: "rose"     },
  slate:   { hex: "#475569", name: "slate"    },
  black:   { hex: "#111111", name: "black"    },
  gold:    { hex: "#B45309", name: "gold"     },
};

const LAYOUT_PROMPTS: Record<string, string> = {
  minimal: `LAYOUT: Minimal. White (#ffffff) background. Abundant whitespace (section padding 100px+). Very clean lines. Subtle borders. Small elegant typography for body, bold for headlines. No clutter.`,
  bold: `LAYOUT: Bold editorial. White background with sections of full black or accent color. Oversized headlines (80px+, weight 900). Strong typographic hierarchy. High contrast. Sections alternate white/dark.`,
  corporate: `LAYOUT: Professional corporate. White background. Structured grid layout. Trust signals visible (stats, certifications). Neutral tones with accent color for CTAs. Business-focused, authoritative.`,
  dark: `LAYOUT: Dark premium. #0d0d0d background, #1a1a1a for cards, white text. Premium dark aesthetic. Accent color glows/pops against dark. Subtle #ffffff10 borders.`,
};

const FONT_PROMPTS: Record<string, string> = {
  modern:   `FONT: Import from Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">. Use 'Inter', system-ui, sans-serif everywhere.`,
  elegant:  `FONT: Import from Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@400;500&display=swap" rel="stylesheet">. Use 'Playfair Display' for all headings (H1-H3), 'Inter' for body text. Luxury editorial feel.`,
  friendly: `FONT: Import from Google Fonts: <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">. Use 'Nunito', sans-serif everywhere. Rounded, warm, approachable.`,
  mono:     `FONT: Import from Google Fonts: <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">. Use 'JetBrains Mono' for headings and labels, 'Inter' for body. Technical, developer-focused aesthetic.`,
};

const ANIMATION_PROMPTS: Record<string, string> = {
  none: `ANIMATIONS: None. No transitions, no animations. Pure static HTML for maximum speed.`,
  subtle: `ANIMATIONS: Subtle. Add these CSS animations:
- Buttons: transition: all 0.2s ease on hover (slight scale + color shift)
- Cards: box-shadow transition on hover (0.2s ease)
- Add a simple fade-in on page load: @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } } and apply animation: fadeIn 0.5s ease forwards to hero elements with staggered delays.`,
  dynamic: `ANIMATIONS: Dynamic. Use Intersection Observer in JavaScript for scroll-triggered animations:
- Elements fade + slide up when entering viewport (translateY(30px) → 0, opacity 0→1, 0.5s ease)
- Stagger child elements with delay increments (0, 100ms, 200ms, 300ms)
- Smooth scroll behavior: html { scroll-behavior: smooth; }
- Number counter animation for stats (count up from 0 when visible)
- Hover parallax tilt effect on cards using mousemove event`,
};

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      businessName: string;
      description: string;
      color?: string;
      layout?: string;
      font?: string;
      animation?: string;
      sessionId?: string;
    };
    const { businessName, description, sessionId } = body;
    const colorKey    = body.color     ?? "violet";
    const layoutKey   = body.layout    ?? "minimal";
    const fontKey     = body.font      ?? "modern";
    const animKey     = body.animation ?? "subtle";

    if (!businessName || !description) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    if (sessionId) {
      const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ error: "Payment not completed" }), { status: 402 });
      }
    }

    const colorInfo  = COLOR_MAP[colorKey]  ?? COLOR_MAP.violet;
    const layoutDesc = LAYOUT_PROMPTS[layoutKey] ?? LAYOUT_PROMPTS.minimal;
    const fontDesc   = FONT_PROMPTS[fontKey]     ?? FONT_PROMPTS.modern;
    const animDesc   = ANIMATION_PROMPTS[animKey] ?? ANIMATION_PROMPTS.subtle;

    const prompt = `You are an expert web designer and developer. Create a stunning, complete, professional single-page website as ONE self-contained HTML file.

BUSINESS NAME: ${businessName}
BUSINESS DESCRIPTION: ${description}

PRIMARY ACCENT COLOR: ${colorInfo.hex} (${colorInfo.name}) — use this as the main accent/CTA color throughout.

${layoutDesc}

${fontDesc}

${animDesc}

SECTIONS TO INCLUDE:
1. Sticky nav: logo/brand name + navigation links + one CTA button in accent color
2. Hero: powerful headline (tailored to the business), sub-headline, 2 CTA buttons (primary in accent, secondary outlined)
3. Services/Features: 3 cards in a responsive grid — real content based on the business
4. About/Trust: short paragraph + 3 stats or trust signals
5. Contact/CTA: headline + email input + submit button in accent color
6. Footer: logo, links, copyright

HARD RULES:
- Output ONLY raw HTML. Start with <!DOCTYPE html>. Zero explanation, zero markdown.
- ALL CSS must be in a <style> tag inside <head>. No external CSS files.
- ALL JavaScript must be in a <script> tag before </body>. No external JS files.
- The font <link> tag goes inside <head> as specified above.
- Fully responsive with mobile-first media queries.
- Write REAL copy based on the business — absolutely NO placeholder text, NO Lorem Ipsum.
- All text must have strong contrast against its background (WCAG AA minimum).
- Buttons must have hover states.
- Cards must have hover states.
- The page must look visually complete and pixel-perfect when opened in any browser.
- Use ${colorInfo.hex} as the primary accent consistently for buttons, links, highlights, and borders.`;

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
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
