import { createClient } from '@supabase/supabase-js';

// Initialization
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { topic, platform, tone, userId } = req.body;

  // 1. Basic Validation
  if (!userId) return res.status(401).json({ error: "Unauthorized: No User ID" });
  if (!topic) return res.status(400).json({ error: "Missing topic" });

  try {
    // 2. Check User Token Balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: "Profile not found in database" });
    }

    if (profile.tokens <= 0) {
      return res.status(403).json({ error: "Out of tokens. Please upgrade." });
    }

    // 3. Call Groq AI API
    const prompt = `Generate 3 viral hooks for ${platform} about ${topic}. Tone: ${tone}. Return only the hooks, no hashtags.`;
    
    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!aiRes.ok) throw new Error("AI service failed");

    const aiData = await aiRes.json();
    const content = aiData.choices[0].message.content;
    const hooks = content.split("\n").filter(line => line.trim().length > 5).slice(0, 3);

    // 4. Deduct 1 Token from Supabase
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ tokens: profile.tokens - 1 })
      .eq('id', userId);

    if (updateError) console.error("Token deduction failed:", updateError);

    return res.status(200).json({ hooks });

  } catch (error) {
    console.error("Runtime Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
