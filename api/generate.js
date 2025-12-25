export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { topic, platform, tone } = req.body;

    if (!topic || !platform || !tone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const prompt = `Generate 5 viral, scroll-stopping hooks for a ${platform} video.
    Topic: ${topic}
    Tone: ${tone}
    Rules: 
    - No emojis
    - No hashtags
    - One hook per line
    - Max 15 words per hook
    - Return ONLY the hooks.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Groq API Error" });
    }

    const text = data.choices[0].message.content;

    // Clean up the text: split into lines and remove list numbers (1., 2., etc)
    const hooks = text
      .split("\n")
      .map(h => h.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter(h => h.length > 0)
      .slice(0, 5);

    return res.status(200).json({ hooks });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
