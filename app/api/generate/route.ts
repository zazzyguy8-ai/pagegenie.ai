import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json() as { businessName: string; description: string };
    const { businessName, description } = body;

    if (!businessName || !description) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const prompt = `You are a world-class web designer. Create a complete, visually stunning single-page website as ONE self-contained HTML file.

BUSINESS NAME: ${businessName}
BUSINESS DESCRIPTION: ${description}

Study this business carefully. Understand its industry, target audience, and emotional positioning. Then design something that feels custom-built by a top agency — not a template.

━━━ VISUAL DESIGN ━━━
- Choose a distinctive color palette that matches the industry psychology (NOT generic blue/purple)
- Pick a Google Font that fits the brand personality
- Use REAL Unsplash photos — embed them directly with this URL format:
  https://images.unsplash.com/photo-PHOTO_ID?auto=format&fit=crop&w=1200&q=80
- Choose 3-4 actual Unsplash photo IDs from your training data that are visually relevant to this business type
- Hero section: full-width background image with a semi-transparent overlay (rgba dark or brand color at 0.6 opacity) so text is always readable over it
- Cards and about section: use a second Unsplash image as a decorative element

━━━ SECTIONS (each needs an id attribute) ━━━
1. <nav id="nav"> — sticky header, logo/brand name on left, nav links (href="#services", href="#about", href="#contact") in middle, CTA button on right
2. <section id="hero"> — min-height: 100vh, background image with overlay, big headline, subheadline, 2 buttons
3. <section id="services"> — "Our Services" or "What We Offer", 3 cards in CSS grid, each with an icon (use Unicode emoji or simple SVG), title, description
4. <section id="about"> — about paragraph + 3 stats (numbers + labels) side by side
5. <section id="contact"> — headline, name input, email input, message textarea, submit button
6. <footer> — brand name, copyright, 3 nav links

━━━ INTERACTIONS (must all work) ━━━
- html { scroll-behavior: smooth; } — so nav links actually scroll
- All nav links use href="#section-id" and scroll to the correct section
- Mobile hamburger menu: a ☰ button that toggles a dropdown nav on screens < 768px
- Buttons: transform: translateY(-2px) and box-shadow on hover
- Cards: subtle lift on hover (translateY + shadow)
- Fade-in on scroll: use IntersectionObserver to add a "visible" class, CSS handles opacity 0→1 + translateY(20px)→0

━━━ HARD RULES ━━━
- Output ONLY raw HTML starting with <!DOCTYPE html>. Zero explanation, zero markdown fences.
- ALL CSS in one <style> tag inside <head>
- ALL JavaScript in one <script> tag just before </body>
- Google Font <link> tag inside <head>
- Real copy only — write actual headlines, descriptions, services based on this specific business
- Every section must have a visible, non-black background color with readable text
- NEVER leave any section with just a black or empty background
- Mobile responsive with @media (max-width: 768px) queries
- The page must look like it cost €8,000 to build`;

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
