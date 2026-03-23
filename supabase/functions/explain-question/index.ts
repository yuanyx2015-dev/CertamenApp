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

    console.log('Received request:', { questionText, correctAnswer })

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
    console.log('Gemini key exists:', !!geminiKey)
    
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: 'Gemini API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Split question by commas to identify clues
    const clues = questionText.split(',').map((clue: string) => clue.trim()).filter((clue: string) => clue.length > 0)

    // Create prompt for Gemini
    const prompt = `You are a Latin/Roman Certamen expert helping students understand quiz questions. 

Question: "${questionText}"
Answer: "${correctAnswer}"

The question contains ${clues.length} clue(s) separated by commas. Please explain how EACH clue relates to the answer "${correctAnswer}" in a clear, concise, and educational way.

Format your response as a numbered list, with one explanation per clue. Keep each explanation to 1-2 sentences maximum.`

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error status:', response.status)
      console.error('Gemini API error body:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get explanation from Gemini',
          status: response.status,
          details: errorText 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const aiResponse = await response.json()
    console.log('Gemini response:', JSON.stringify(aiResponse))
    const explanation = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No explanation generated'

    return new Response(
      JSON.stringify({ 
        explanation,
        clueCount: clues.length 
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
