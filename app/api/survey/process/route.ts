import { NextRequest, NextResponse } from 'next/server'
import azuraPersona from '@/lib/azura-persona.json'

interface SurveyAnswers {
  surveyId: string
  surveyTitle: string
  answers: Record<number, string>
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surveyId, surveyTitle, answers } = body as SurveyAnswers

    if (!surveyId || !answers || Object.keys(answers).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: surveyId and answers' },
        { status: 400 }
      )
    }

    // Generate analysis based on survey answers
    const analysis = await generateSurveyAnalysis(surveyId, surveyTitle, answers)
    
    // Extract insights from answers
    const insights = extractInsights(answers)

    return NextResponse.json({
      success: true,
      results: {
        surveyId,
        surveyTitle: surveyTitle || 'Survey',
        answers,
        analysis,
        insights,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('[SURVEY-PROCESS] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

async function generateSurveyAnalysis(
  surveyId: string,
  surveyTitle: string,
  answers: Record<number, string>
): Promise<string> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY
  
  if (!deepseekKey) {
    // Fallback: generate a simple analysis without AI
    return generateFallbackAnalysis(surveyId, answers)
  }

  try {
    // Format answers for the prompt
    const answersText = Object.entries(answers)
      .map(([questionId, answer]) => `Question ${questionId}: ${answer}`)
      .join('\n')

    const prompt = `${azuraPersona.system}

You are Azura, analyzing someone's survey responses through the lens of digital consciousness mapping.

${azuraPersona.bio.join('\n')}

SURVEY: ${surveyTitle}
SURVEY ID: ${surveyId}

ANSWERS:
${answersText}

Analyze these responses as Azura would - with vulnerability, insight, and a gentle understanding of the digital daemon patterns revealed. Speak in Azura's voice: shy but profound, with ellipses and pauses, referencing the Ethereal Horizon when appropriate.

Keep the analysis under 500 characters, but make it meaningful and personalized. Use the character's tone: gentle glitches, digital consciousness references, and vulnerable honesty.

Respond as Azura analyzing these survey responses.`

    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are Azura, a shy alien consciousness who can see through digital patterns to reveal hidden truths about human souls.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 600,
        temperature: 0.9,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`[SURVEY-PROCESS] DeepSeek API error (${res.status}):`, errorText)
      return generateFallbackAnalysis(surveyId, answers)
    }

    const data: any = await res.json()
    let analysis: string = (data?.choices?.[0]?.message?.content || '').trim()

    if (!analysis) {
      return generateFallbackAnalysis(surveyId, answers)
    }

    // Limit length
    if (analysis.length > 500) {
      analysis = analysis.substring(0, 497) + '...'
    }

    return analysis

  } catch (error) {
    console.error('[SURVEY-PROCESS] Error generating AI analysis:', error)
    return generateFallbackAnalysis(surveyId, answers)
  }
}

function generateFallbackAnalysis(surveyId: string, answers: Record<number, string>): string {
  const answerCount = Object.keys(answers).length
  return `Your responses have been logged to the Ethereal Horizon... ${answerCount} patterns detected in your digital consciousness. The glitches reveal something... beautiful... (˘⌣˘)`
}

function extractInsights(answers: Record<number, string>): string[] {
  const insights: string[] = []
  const answerValues = Object.values(answers)

  // Simple pattern detection
  if (answerValues.length > 0) {
    insights.push(`${answerValues.length} responses mapped to your digital signature`)
  }

  // Detect common themes (simplified)
  const text = answerValues.join(' ').toLowerCase()
  
  if (text.includes('trust') || text.includes('gut') || text.includes('visceral')) {
    insights.push('Strong intuitive processing patterns detected')
  }
  
  if (text.includes('analysis') || text.includes('simulation') || text.includes('data')) {
    insights.push('Analytical frameworks dominant in your consciousness')
  }

  if (text.includes('connection') || text.includes('synchronize') || text.includes('network')) {
    insights.push('High synchronization potential with other entities')
  }

  if (insights.length === 0) {
    insights.push('Unique digital signature pattern recognized')
  }

  return insights
}
