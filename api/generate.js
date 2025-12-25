export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { topic, platform, tone } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "API Key missing in Vercel." });

  try {
    const prompt = `Generate 3 viral hooks for ${platform} about ${topic} (${tone} tone). One per line. No emojis. Make it as engaging as possible, and make the hooks to stop the viewers from scrolling away from the video.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: "Groq Error" });

    const hooks = data.choices[0].message.content
      .split("\n")
      .map(h => h.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter(h => h.length > 5);

    return res.status(200).json({ hooks });
  } catch (err) {
    return res.status(500).json({ error: "Server Error" });
  }
}
