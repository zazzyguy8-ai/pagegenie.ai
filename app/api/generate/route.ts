import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json() as { businessName: string; description: string };
    const { businessName, description } = body;

    if (!businessName || !description) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const prompt = `You are an elite web designer. Create a stunning, complete, professional single-page website as ONE self-contained HTML file.

BUSINESS NAME: ${businessName}
BUSINESS DESCRIPTION: ${description}

Your job: read the business, understand its industry and audience, then design and build the perfect website for it. Choose everything yourself — colors, fonts, layout, style, copy. Make it feel like it was designed by a world-class agency specifically for this business.

SECTIONS:
1. Sticky nav: logo/name + navigation links + CTA button
2. Hero: powerful headline + subheadline + 2 CTA buttons
3. Services or Features: 3 cards in a responsive grid
4. About / Trust: short paragraph + 3 stats or trust signals
5. Contact / CTA: headline + email input + button
6. Footer: logo, links, copyright

RULES:
- Output ONLY raw HTML starting with <!DOCTYPE html>. No explanation, no markdown.
- All CSS inside a <style> tag in <head>. All JS inside a <script> tag before </body>.
- Load ONE Google Font that fits the brand via <link> in <head>.
- Fully responsive with mobile media queries.
- Write REAL copy based on the business. Zero placeholder text. Zero Lorem Ipsum.
- Strong color contrast everywhere. Text must always be readable.
- Smooth hover effects on buttons and cards.
- Scroll-triggered fade-in animations using Intersection Observer.
- The result must look like a real €5,000 agency website.`;

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
