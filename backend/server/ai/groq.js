/**
 * Cliente mínimo Groq (API compatible con OpenAI).
 * https://console.groq.com/docs/quickstart
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function defaultModel() {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
}

export async function groqGenerateText(apiKey, prompt, options = {}) {
  const model = options.model || defaultModel()

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.65,
      max_tokens: options.maxOutputTokens ?? 8192,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Groq HTTP ${res.status}`
    throw new Error(msg)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('La IA no devolvió texto.')
  }
  return { text, model }
}

export function parseJsonFromModel(text) {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1].trim() : trimmed
  return JSON.parse(raw)
}
