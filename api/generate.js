import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send();
  const { topic, platform, tone, userId } = req.body;

  if (!userId) return res.status(401).json({ error: "Please sign in" });

  try {
    const { data: profile } = await supabase.from('profiles').select('tokens').eq('id', userId).single();
    if (!profile || profile.tokens <= 0) return res.status(403).json({ error: "No tokens left!" });

    const prompt = `Generate 3 viral, high-retention hooks for ${platform}. Topic: ${topic}. Tone: ${tone}. 
    Plain text, one per line. Max 12 words per hook.`;

    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }] })
    });

    const aiData = await aiRes.json();
    const hooks = aiData.choices[0].message.content.split("\n")
      .map(h => h.replace(/^\d+[\.\)\-]\s*/, "").trim())
      .filter(h => h.length > 5);

    await supabase.from('profiles').update({ tokens: profile.tokens - 1 }).eq('id', userId);
    return res.status(200).json({ hooks });
  } catch (err) { return res.status(500).json({ error: "Server error" }); }
}
