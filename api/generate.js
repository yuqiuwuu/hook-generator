import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { topic, platform, tone, userId } = req.body;

  // 1. Safety Checks
  if (!userId) return res.status(401).json({ error: "Please sign in first!" });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: "API Key missing" });

  try {
    // 2. Database Check: Does the user have tokens?
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.tokens <= 0) {
      return res.status(403).json({ error: "No tokens left! Please contact support for more." });
    }

    // 3. The AI Call (Groq)
    const prompt = `Generate 3 viral hooks for ${platform} about ${topic} (${tone} tone). One per line. No emojis. Make them scroll-stopping.`;

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) return res.status(500).json({ error: "AI Generation failed" });

    // Clean up the hooks
    const hooks = aiData.choices[0].message.content
      .split("\n")
      .map(h => h.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter(h => h.length > 5);

    // 4. Success! Deduct 1 token from Supabase
    await supabase
      .from('profiles')
      .update({ tokens: profile.tokens - 1 })
      .eq('id', userId);

    return res.status(200).json({ hooks, remainingTokens: profile.tokens - 1 });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server Error" });
  }
}
