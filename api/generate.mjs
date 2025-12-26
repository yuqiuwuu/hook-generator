// api/generate.mjs — Vercel serverless function (ESM) using Supabase only.
// Behavior:
//  - Tries to find a matching row in the 'hooks' table by topic (case-insensitive partial match).
//  - If found, returns the hooks array from the row.
//  - If not found, returns a deterministic fallback hooks array and, if a service role key is available, inserts the fallback into the table.
//
// Environment variables expected in Vercel:
//  - SUPABASE_URL                      (required to use Supabase)
//  - SUPABASE_SERVICE_ROLE_KEY         (server-only key, optional but required to insert/save)
//  - SUPABASE_ANON_KEY or SUPABASE_KEY (optional read-only key; used if service role key not present)

import { createClient } from '@supabase/supabase-js'

function fallbackGenerateHooks(topic) {
  const base = `Hook idea for "${topic}":`
  return [
    `${base} Start with a surprising stat and finish with a clear call-to-action.`,
    `${base} Open with a short personal story, then share the one tip that changed everything.`,
    `${base} Ask a bold question in the first 2 seconds and promise a quick result.`,
  ]
}

function normalizeHooksField(hooksField) {
  if (!hooksField) return []
  if (Array.isArray(hooksField) && hooksField.every(h => typeof h === 'string')) return hooksField
  if (Array.isArray(hooksField)) return hooksField.map(h => {
    if (typeof h === 'string') return h
    if (h && typeof h === 'object') return h.text ?? JSON.stringify(h)
    return String(h)
  }).filter(Boolean)
  return [String(hooksField)]
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  const { topic } = req.body || {}
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return res.status(400).json({ error: 'Missing or empty "topic" in request body' })
  }
  const cleanTopic = topic.trim()

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  // allow common anon env names as fallback for read-only
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_KEY ?? process.env.SUPABASE_ANON

  if (!SUPABASE_URL || (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY)) {
    // If Supabase info missing, return fallback (safe default)
    const fallback = fallbackGenerateHooks(cleanTopic)
    return res.json({ source: 'fallback', result: fallback, note: 'SUPABASE_URL or keys are not configured server-side' })
  }

  // prefer service role key for server operations (insertion). fallback to anon for reads.
  const clientKey = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY
  const sb = createClient(SUPABASE_URL, clientKey, { auth: { persistSession: false } })

  try {
    // Find latest matching topic (case-insensitive partial match)
    const { data, error } = await sb
      .from('hooks')
      .select('id, topic, hooks, source, created_at')
      .ilike('topic', `%${cleanTopic}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.warn('Supabase select error', error)
    } else if (Array.isArray(data) && data.length > 0) {
      const row = data[0]
      const hooks = normalizeHooksField(row.hooks)
      return res.json({ source: 'supabase', foundTopic: row.topic ?? cleanTopic, result: hooks, saved: { id: row.id } })
    }

    // Not found: produce fallback hooks
    const fallback = fallbackGenerateHooks(cleanTopic)

    // If we have the service role key, try to insert the fallback into the table for future queries
    if (SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: inserted, error: insertError } = await sb
          .from('hooks')
          .insert([{ topic: cleanTopic, hooks: fallback, source: 'fallback' }])
          .select()
          .limit(1)

        if (insertError) {
          console.warn('Supabase insert error', insertError)
          return res.json({ source: 'fallback', result: fallback })
        }

        return res.json({ source: 'fallback+saved', result: fallback, saved: inserted?.[0] ?? null })
      } catch (err) {
        console.warn('Supabase insert exception', String(err))
        return res.json({ source: 'fallback', result: fallback })
      }
    }

    // No service key available (read-only anon key used) — return fallback without saving
    return res.json({ source: 'fallback', result: fallback, note: 'No service role key; not saved' })
  } catch (err) {
    console.error('Unexpected error in /api/generate:', err)
    const fallback = fallbackGenerateHooks(cleanTopic)
    return res.status(500).json({ error: 'Internal server error', details: String(err), result: fallback })
  }
}
