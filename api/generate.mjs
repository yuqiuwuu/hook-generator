import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 1. Setup Supabase with Secret Environment Variables
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    const { topic, userId } = req.body;

    // 2. Validate User Session
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // 3. Token Check (Optional but recommended)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', userId)
      .single();

    if (profileError || !profile || profile.tokens <= 0) {
      return res.status(403).json({ error: "No tokens left. Please refresh or contact support." });
    }

    // 4. Call Groq AI
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a viral marketing expert. Generate 3 high-impact, curiosity-driven hooks for a video based on the user's topic. Format as a simple JSON array of strings: [\"hook1\", \"hook2\", \"hook3\"]. No intro or outro text."
          },
          {
            role: "user",
            content: `Topic: ${topic}`
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const groqData = await groqResponse.json();
    
    // Safety check for AI response
    if (!groqData.choices) {
        throw new Error("AI failed to respond");
    }

    const hooksString = groqData.choices[0].message.content;
    const hooksArray = JSON.parse(hooksString).hooks || JSON.parse(hooksString);

    // 5. Deduct 1 Token
    await supabase
      .from('profiles')
      .update({ tokens: profile.tokens - 1 })
      .eq('id', userId);

    // 6. Send Hooks to Frontend
    return res.status(200).json({ hooks: Array.isArray(hooksArray) ? hooksArray : [hooksArray] });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
