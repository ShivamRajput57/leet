// api/graphql.js  (Vercel Serverless Function)
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    // Body already parsed by Vercel as JSON (if Content-Type: application/json).
    const body = req.body;

    // Forward the request to LeetCode GraphQL
    const lcRes = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Helpful headers — keep them; LeetCode sometimes expects X-Requested-With and a Referer
        "x-requested-with": "XMLHttpRequest",
        "referer": "https://leetcode.com/",
        // do NOT set origin here --- fetch runs server-side
      },
      body: JSON.stringify(body),
    });

    const text = await lcRes.text(); // preserve any non-JSON error body
    res.status(lcRes.status).send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "proxy error", details: String(err) });
  }
}
