// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
              text: fullPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
          }
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Gemini API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to get answer from AI' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const aiResponse = await response.json()
    const answer = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate an answer.'

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
