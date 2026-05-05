// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getGeminiModelChain(): string[] {
  const chainEnv = Deno.env.get('GEMINI_MODEL_CHAIN')?.trim()
  if (chainEnv) {
    return [...new Set(chainEnv.split(',').map((s) => s.trim()).filter(Boolean))]
  }
  const primary = Deno.env.get('GEMINI_MODEL')?.trim()
  const defaults = [
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ]
  if (primary) {
    return [...new Set([primary, ...defaults.filter((m) => m !== primary)])]
  }
  return defaults
}

async function geminiGenerateContentWithFallback(
  geminiKey: string,
  body: Record<string, unknown>
): Promise<
  | { ok: true; json: Record<string, unknown>; modelUsed: string }
  | { ok: false; status: number; errorText: string; modelsTried: string[] }
> {
  const models = getGeminiModelChain()
  const modelsTried: string[] = []
  let lastStatus = 500
  let lastText = ''

  for (const model of models) {
    modelsTried.push(model)
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const json = (await response.json()) as Record<string, unknown>
      if (modelsTried.length > 1) {
        console.warn(`ai-tutor: fallback succeeded with ${model}`)
      }
      return { ok: true, json, modelUsed: model }
    }

    lastText = await response.text()
    lastStatus = response.status
    console.warn(
      `ai-tutor: model ${model} -> HTTP ${response.status}`,
      lastText.slice(0, 400)
    )

    if (response.status === 429 || response.status === 503 || response.status === 404) {
      continue
    }

    return { ok: false, status: response.status, errorText: lastText, modelsTried }
  }

  return { ok: false, status: lastStatus, errorText: lastText, modelsTried }
}

function extractGeminiAnswerText(aiResponse: Record<string, unknown>): string {
  const parts =
    (aiResponse.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined)?.[0]
      ?.content?.parts ?? []
  const chunks = parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .filter((t) => t.length > 0)
  const joined = chunks.join('').trim()
  if (joined.length > 0) return joined
  const fb = parts[0]?.text
  return typeof fb === 'string' && fb.trim().length > 0
    ? fb.trim()
    : 'Sorry, I could not generate an answer.'
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { question, userId } = await req.json()

    if (!question || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing question or userId' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validate question length (max 500 characters)
    if (question.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Question too long (max 500 characters)' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if user has remaining questions today
    const { data: usageData, error: usageError } = await supabase.rpc('get_ai_tutor_usage', {
      p_user_id: userId
    })

    if (usageError) {
      console.error('Error checking usage:', usageError)
      return new Response(
        JSON.stringify({ error: 'Failed to check usage limit' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const remainingQuestions = usageData?.[0]?.remaining_questions ?? 2

    if (remainingQuestions <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Daily limit reached',
          limitReached: true,
          message: 'You have reached your daily limit of 2 custom questions. Try again tomorrow!'
        }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Gemini API key from environment variables
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create system prompt for Gemini - focused on Certamen/Roman topics
    const systemPrompt = `You are a knowledgeable Latin and Roman Certamen tutor. Your role is to help students learn about:
- Roman and Greek mythology
- Ancient Roman history and culture
- Latin language and grammar
- Roman literature and authors
- Daily life in ancient Rome
- Roman government and military

Keep your answers clear, concise (2-4 sentences), and educational. If a question is off-topic or inappropriate, politely redirect the student to Certamen-related topics. Be encouraging and supportive.`

    const fullPrompt = `${systemPrompt}\n\nStudent question: ${question}\n\nYour answer:`

    const geminiBody = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    }

    const geminiResult = await geminiGenerateContentWithFallback(geminiKey, geminiBody)

    if (!geminiResult.ok) {
      let geminiDetail = geminiResult.errorText.slice(0, 1500)
      try {
        const parsed = JSON.parse(geminiResult.errorText) as Record<string, unknown>
        geminiDetail = JSON.stringify(parsed.error ?? parsed, null, 2).slice(0, 1500)
      } catch {
        /* raw */
      }
      return new Response(
        JSON.stringify({
          error: 'Failed to get answer from AI',
          geminiHttpStatus: geminiResult.status,
          modelsTried: geminiResult.modelsTried,
          geminiDetail,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const aiResponse = geminiResult.json
    const answer = extractGeminiAnswerText(aiResponse)

    // Increment usage count
    const { error: incrementError } = await supabase.rpc('increment_ai_tutor_usage', {
      p_user_id: userId
    })

    if (incrementError) {
      console.error('Error incrementing usage:', incrementError)
      // Don't fail the request, just log the error
    }

    return new Response(
      JSON.stringify({ 
        answer,
        remainingQuestions: remainingQuestions - 1
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
