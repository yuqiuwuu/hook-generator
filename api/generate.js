import { createClient } from '@supabase/supabase-js';

// Initialize Supabase outside the handler
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { topic, platform, tone, userId } = req.body;

  // 2. Check if user is logged in
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: No user ID provided" });
  }

  try {
    // 3. Check token balance in Supabase
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    if (profile.tokens <= 0) {
      return res.status(403).json({ error: "Out of tokens!" });
    }

    // 4. Call Groq AI
    const prompt = `Generate 3 viral hooks for ${platform} about ${topic}. Tone: ${tone}. One per line. Max 15 words per hook. No hashtags.`;
    
    const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!aiRes.ok) {
      const errorData = await aiRes.json();
      console.error("AI Error:", errorData);
      return res.status(502).json({ error: "AI Service error" });
    }

    const aiData = await aiRes.json();
    const hooks = aiData.choices[0].message.content
      .split("\n")
      .filter(h => h.trim().length > 0)
      .slice(0, 3); // Ensure only 3 hooks are returned

    // 5. Deduct 1 Token from the user's account
    await supabase
      .from('profiles')
      .update({ tokens: profile.tokens - 1 })
      .eq('id', userId);

    // 6. Return the hooks to the frontend
    return res.status(200).json({ hooks });

  } catch (err) {
    console.error("Server Crash:", err);
    return res.status(500).json({ error: "Server Error: " + err.message });
  }
}
