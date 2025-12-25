import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const { topic, platform, tone, userId } = req.body;
  if (!userId) return res.status(401).json({ error: "No User ID" });

  try {
    // 1. Check Token Balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', userId)
      .single();

    if (profileError || !profile) return res.status(404).json({ error: "Profile not found" });
    if (profile.tokens <= 0) return res.status(403).json({ error: "No tokens left" });

    // 2. Call AI (Groq)
    const prompt = `Generate 3 short viral hooks for ${platform} about ${topic}. Tone: ${tone}. No hashtags.`;
    
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

    // Check if Groq failed
    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error("Groq API Error:", errorText);
      return res.status(502).json({ error: "AI Service Busy" });
    }

    const aiData = await aiRes.json();
    
    // Safety check for the AI response structure
    if (!aiData.choices || !aiData.choices[0]) {
      return res.status(500).json({ error: "AI returned empty response" });
    }

    const content = aiData.choices[0].message.content;
    const hooks = content.split("\n").filter(h => h.trim().length > 5).slice(0, 3);

    // 3. Deduct Token
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ tokens: profile.tokens - 1 })
      .eq('id', userId);

    if (updateError) console.error("Token update failed:", updateError);

    // 4. Send Success
    return res.status(200).json({ hooks });

  } catch (err) {
    console.error("Full Backend Crash:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
