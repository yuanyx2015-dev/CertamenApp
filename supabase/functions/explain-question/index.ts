// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { questionText, correctAnswer } = await req.json()

    if (!questionText || !correctAnswer) {
      return new Response(
        JSON.stringify({ error: 'Missing questionText or correctAnswer' }),
        {
          status: 400,
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

    // Count clues (separated by commas or sentence boundaries)
    const clues = questionText.split(/,(?![^(]*\))/).filter((c: string) => c.trim().length > 0)
    const clueCount = clues.length

    const prompt = `You are a knowledgeable Latin and Roman Certamen tutor. A student just answered a Certamen question and you need to explain it clearly.

Question: "${questionText}"
Correct Answer: ${correctAnswer}

Please provide a clear, educational explanation that:
1. Confirms why "${correctAnswer}" is correct
2. Briefly explains each clue in the question and how it points to the answer
3. Adds any interesting mythological, historical, or cultural context

Keep the explanation concise (3-5 sentences total), engaging, and educational. Format it as a single flowing paragraph.`

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 400,
          }
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to get explanation from AI' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const aiResponse = await response.json()
    const explanation = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text
      || 'Sorry, I could not generate an explanation.'

    return new Response(
      JSON.stringify({ explanation, clueCount }),
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
