// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

/** Gemini may split output across multiple `parts`; using only `parts[0]` truncates or shows junk fragments. */
function extractGeminiExplanation(aiResponse: Record<string, unknown>): string {
  const candidates = aiResponse.candidates as
    | Array<Record<string, unknown>>
    | undefined
  const cand = candidates?.[0] as Record<string, unknown> | undefined
  const content = cand?.content as
    | { parts?: Array<{ text?: string }> }
    | undefined
  const parts = content?.parts ?? []
  const chunks = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .filter((t) => t.length > 0)
  const joined = chunks.join("").trim()
  if (joined.length > 0) return joined
  const fallback = parts[0]?.text
  return typeof fallback === "string" && fallback.trim().length > 0
    ? fallback.trim()
    : "Sorry, I could not generate an explanation."
}

function countClues(questionText: string): number {
  const clues = questionText.split(/,(?![^(]*\))/).filter((c: string) =>
    c.trim().length > 0
  )
  return clues.length
}

/**
 * Try models in order. On 429 (quota) or 503/404, automatically try the next model.
 * Override full order with secret GEMINI_MODEL_CHAIN=gemini-3-flash-preview,gemini-2.5-flash,...
 * Or set GEMINI_MODEL only to prepend one preferred model before defaults.
 */
function getGeminiModelChain(): string[] {
  const chainEnv = Deno.env.get("GEMINI_MODEL_CHAIN")?.trim()
  if (chainEnv) {
    return [
      ...new Set(chainEnv.split(",").map((s) => s.trim()).filter(Boolean)),
    ]
  }
  const primary = Deno.env.get("GEMINI_MODEL")?.trim()
  const defaults = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
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
  | {
      ok: false
      status: number
      errorText: string
      modelsTried: string[]
    }
> {
  const models = getGeminiModelChain()
  const modelsTried: string[] = []
  let lastStatus = 500
  let lastText = ""

  for (const model of models) {
    modelsTried.push(model)
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const json = (await response.json()) as Record<string, unknown>
      if (modelsTried.length > 1) {
        console.warn(`explain-question: fallback succeeded with ${model}`)
      }
      return { ok: true, json, modelUsed: model }
    }

    lastText = await response.text()
    lastStatus = response.status
    console.warn(
      `explain-question: model ${model} -> HTTP ${response.status}`,
      lastText.slice(0, 400)
    )

    if (
      response.status === 429 ||
      response.status === 503 ||
      response.status === 404
    ) {
      continue
    }

    return { ok: false, status: response.status, errorText: lastText, modelsTried }
  }

  return {
    ok: false,
    status: lastStatus,
    errorText: lastText,
    modelsTried,
  }
}

/** Single-model call — used only to try upgrading cache to `bestModel` (no fallback chain). */
/** PostgREST / schema-cache errors when optional migration columns are absent. */
function isMissingDbColumnError(
  err: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!err) return false
  if (err.code === "PGRST204") return true
  const m = (err.message ?? "").toLowerCase()
  return (
    m.includes("schema cache") ||
    (m.includes("could not find") && m.includes("column"))
  )
}

async function geminiGenerateSingleModel(
  geminiKey: string,
  model: string,
  body: Record<string, unknown>
): Promise<
  | { ok: true; json: Record<string, unknown> }
  | { ok: false; status: number; errorText: string }
> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (response.ok) {
    return { ok: true, json: (await response.json()) as Record<string, unknown> }
  }
  return {
    ok: false,
    status: response.status,
    errorText: await response.text(),
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { questionText, correctAnswer, questionId } = await req.json()

    if (!questionText || !correctAnswer || !questionId) {
      return new Response(
        JSON.stringify({
          error: "Missing questionText, correctAnswer, or questionId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase admin credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: questionRow } = await supabaseAdmin
      .from("questions")
      .select("question_text, correct_answer, category, difficulty")
      .eq("id", questionId)
      .maybeSingle()

    const effectiveQuestionText =
      (questionRow?.question_text as string | undefined)?.trim() ||
      questionText
    const effectiveCorrectAnswer =
      (questionRow?.correct_answer as string | undefined)?.trim() ||
      correctAnswer

    const clueCount = countClues(effectiveQuestionText)

    const modelChain = getGeminiModelChain()
    const bestModel = modelChain[0] ?? "gemini-3-flash-preview"

    const prompt =
      `You are a knowledgeable Latin and Roman Certamen tutor. A student just answered a Certamen question and you need to explain it clearly.

Question: "${effectiveQuestionText}"
Correct Answer: ${effectiveCorrectAnswer}

Please provide a clear, educational explanation that:
1. Confirms why "${effectiveCorrectAnswer}" is correct
2. Briefly explains each clue in the question and how it points to the answer
3. Adds any interesting mythological, historical, or cultural context

Keep the explanation concise (3-5 sentences total), engaging, and educational. Format it as a single flowing paragraph. Do not use markdown headings or bullet lists — plain prose only.`

    const geminiBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
      },
    }

    const { data: cachedRow, error: cacheReadError } = await supabaseAdmin
      .from("question_ai_explanations")
      .select("explanation_text, gemini_model")
      .eq("question_id", questionId)
      .maybeSingle()

    if (cacheReadError) {
      console.error("Cache read error:", cacheReadError)
    }

    /** Cached row: optionally upgrade to `bestModel` only (no chain fallback on upgrade failure). */
    if (cachedRow?.explanation_text) {
      const storedModel = (cachedRow.gemini_model as string | null | undefined)?.trim() ?? ""
      const alreadyBest =
        storedModel.length > 0 &&
        storedModel.toLowerCase() === bestModel.toLowerCase()

      const bumpUsage = async () => {
        const { error: incErr } = await supabaseAdmin.rpc(
          "increment_ai_explanation_usage",
          { p_question_id: questionId }
        )
        if (incErr) {
          console.error("increment_ai_explanation_usage error:", incErr)
        }
      }

      if (alreadyBest) {
        await bumpUsage()
        return new Response(
          JSON.stringify({
            explanation: cachedRow.explanation_text,
            clueCount,
            cached: true,
            geminiModelUsed: bestModel,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }

      const geminiKeyUpgrade = Deno.env.get("GEMINI_API_KEY")
      if (!geminiKeyUpgrade) {
        await bumpUsage()
        return new Response(
          JSON.stringify({
            explanation: cachedRow.explanation_text,
            clueCount,
            cached: true,
            geminiModelUsed: storedModel || null,
            upgradeSkipped: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }

      const upgrade = await geminiGenerateSingleModel(
        geminiKeyUpgrade,
        bestModel,
        geminiBody
      )

      if (upgrade.ok) {
        const candList = upgrade.json.candidates as unknown[] | undefined
        if (candList?.length) {
          const explanation = extractGeminiExplanation(upgrade.json)
          const { error: updErr } = await supabaseAdmin
            .from("question_ai_explanations")
            .update({
              explanation_text: explanation,
              gemini_model: bestModel,
              updated_at: new Date().toISOString(),
            })
            .eq("question_id", questionId)

          if (updErr) {
            console.error("Cache upgrade update error:", updErr)
          }

          await bumpUsage()

          return new Response(
            JSON.stringify({
              explanation,
              clueCount,
              cached: false,
              upgraded: true,
              geminiModelUsed: bestModel,
              persistError: updErr?.message ?? null,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          )
        }
      }

      if (!upgrade.ok) {
        console.warn(
          `explain-question: upgrade to ${bestModel} failed HTTP ${upgrade.status}`
        )
      } else {
        console.warn(
          `explain-question: upgrade to ${bestModel} returned no candidates`
        )
      }

      await bumpUsage()

      return new Response(
        JSON.stringify({
          explanation: cachedRow.explanation_text,
          clueCount,
          cached: true,
          geminiModelUsed: storedModel || null,
          upgradeAttempted: true,
          upgradeFailed: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const geminiResult = await geminiGenerateContentWithFallback(
      geminiKey,
      geminiBody
    )

    if (!geminiResult.ok) {
      let geminiDetail = geminiResult.errorText.slice(0, 1500)
      try {
        const parsed = JSON.parse(geminiResult.errorText) as Record<
          string,
          unknown
        >
        geminiDetail = JSON.stringify(parsed.error ?? parsed, null, 2).slice(
          0,
          1500
        )
      } catch {
        /* keep raw */
      }
      return new Response(
        JSON.stringify({
          error: "Failed to get explanation from AI",
          geminiHttpStatus: geminiResult.status,
          modelsTried: geminiResult.modelsTried,
          geminiDetail,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const aiResponse = geminiResult.json
    const geminiModelUsed = geminiResult.modelUsed

    const candList = aiResponse.candidates as unknown[] | undefined
    if (!candList?.length) {
      console.error("Gemini returned no candidates:", JSON.stringify(aiResponse).slice(0, 2000))
      return new Response(
        JSON.stringify({
          error: "No explanation generated (blocked or empty response)",
          geminiModel: geminiModelUsed,
          geminiDetail: JSON.stringify(aiResponse).slice(0, 1500),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }
    const finishReason = (aiResponse.candidates as Array<{ finishReason?: string }> | undefined)?.[0]
      ?.finishReason
    if (finishReason === "MAX_TOKENS") {
      console.warn("Gemini finished with MAX_TOKENS — reply may be truncated")
    }

    const explanation = extractGeminiExplanation(aiResponse)

    const insertPayloadFull: Record<string, unknown> = {
      question_id: questionId,
      explanation_text: explanation,
      explain_count: 1,
      question_text: effectiveQuestionText,
      correct_answer: effectiveCorrectAnswer,
      category: questionRow?.category ?? null,
      difficulty: questionRow?.difficulty ?? null,
      gemini_model: geminiModelUsed,
    }

    let insertErr = (
      await supabaseAdmin
        .from("question_ai_explanations")
        .insert(insertPayloadFull)
    ).error

    if (insertErr && isMissingDbColumnError(insertErr)) {
      console.warn(
        "explain-question: full insert failed (missing columns?), retrying without snapshot fields — run migration 20260505120000_question_ai_explanations_metadata.sql",
      )
      insertErr = (
        await supabaseAdmin
          .from("question_ai_explanations")
          .insert({
            question_id: questionId,
            explanation_text: explanation,
            explain_count: 1,
            gemini_model: geminiModelUsed,
          })
      ).error
    }

    if (insertErr && isMissingDbColumnError(insertErr)) {
      console.warn(
        "explain-question: retry without gemini_model — run migration 20260505200000_question_ai_explanations_gemini_model.sql",
      )
      insertErr = (
        await supabaseAdmin
          .from("question_ai_explanations")
          .insert({
            question_id: questionId,
            explanation_text: explanation,
            explain_count: 1,
          })
      ).error
    }

    if (insertErr) {
      console.error("Cache insert error:", insertErr)
    }

    return new Response(
      JSON.stringify({
        explanation,
        clueCount,
        cached: false,
        geminiModelUsed,
        persistError: insertErr?.message ?? null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error: unknown) {
    console.error("Error:", error)
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
