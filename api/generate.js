export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, platform, tone } = req.body;

  // 2. Critical Check: Ensure the API key is actually there
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY is missing in Vercel settings." });
  }

  try {
    const prompt = `Generate 5 viral hooks for a ${platform} video about ${topic} in a ${tone} tone. 
    Format: One hook per line. No emojis. No numbers. Max 15 words.`;

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
      return res.status(response.status).json({ error: data.error?.message || "AI Provider Error" });
    }

    const text = data.choices[0].message.content;
    const hooks = text
      .split("\n")
      .map(line => line.replace(/^\d+[\.\)\-]\s*/, "").trim()) // Removes "1." or "2)" prefixes
      .filter(line => line.length > 5); // Filters out empty lines

    return res.status(200).json({ hooks });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
