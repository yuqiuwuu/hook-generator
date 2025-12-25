export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { topic, platform, tone } = req.body;

    if (!topic || !platform || !tone) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const prompt = `
Generate 5 short, viral hooks for a ${platform} video.
Topic: "${topic}"
Tone: ${tone}
Rules:
- Max 15 words per hook
- Scroll-stopping
- No emojis
- Plain text
`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.9
      })
    });

    const data = await response.json();
    const text = data.choices[0].message.content;

    const hooks = text
      .split("\n")
      .map(h => h.replace(/^[0-9.\-•]+/, "").trim())
      .filter(Boolean);

    return res.status(200).json({ hooks });

  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
