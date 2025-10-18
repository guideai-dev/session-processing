import { BaseMetricProcessor } from '../../../base/index.js'
import type { ParsedSession, SessionMetricsData } from '../../../base/types.js'

export class GeminiEngagementProcessor extends BaseMetricProcessor {
  readonly name = 'gemini-engagement'
  readonly metricType = 'engagement'
  readonly description = 'Analyzes user engagement patterns and conversation flow'

  async process(session: ParsedSession): Promise<SessionMetricsData> {
    const userMessages = session.messages.filter(m => m.type === 'user')
    const assistantMessages = session.messages.filter(m => m.type === 'assistant')

    const totalMessages = session.messages.length

    // Calculate turns (user-assistant exchanges)
    let turns = 0
    for (let i = 0; i < session.messages.length - 1; i++) {
      if (session.messages[i].type === 'user' && session.messages[i + 1].type === 'assistant') {
        turns++
      }
    }

    // Count interruptions (user messages that indicate actual interruptions)
    let interruptions = 0
    for (let i = 0; i < session.messages.length; i++) {
      const message = session.messages[i]
      if (message.type === 'user' && i > 0) {
        const prevMessage = session.messages[i - 1]
        // Check if previous message was also user (consecutive user messages = potential interruption)
        // or if content suggests interruption
        if (prevMessage.type === 'user') {
          interruptions++
        } else {
          const content = this.extractContent(message).toLowerCase()
          if (
            content.includes('wait') ||
            content.includes('stop') ||
            content.includes('actually') ||
            content.includes('no, ')
          ) {
            interruptions++
          }
        }
      }
    }

    // Calculate engagement metrics
    const avgTimeBetweenMessages =
      session.messages.length > 1 ? session.duration / (session.messages.length - 1) : 0

    // User message length analysis
    const userMessageLengths = userMessages.map(m => {
      const text = typeof m.content === 'string' ? m.content : m.content?.text || ''
      return text.length
    })

    const avgUserMessageLength =
      userMessageLengths.length > 0
        ? userMessageLengths.reduce((a, b) => a + b, 0) / userMessageLengths.length
        : 0

    // Engagement score (0-100)
    // Based on: number of turns, message frequency, user message depth
    const turnsScore = Math.min(100, (turns / 10) * 100)
    const frequencyScore =
      avgTimeBetweenMessages > 0
        ? Math.max(0, 100 - ((avgTimeBetweenMessages / 60000 - 1) / 9) * 100)
        : 0
    const depthScore = Math.min(100, (avgUserMessageLength / 200) * 100)

    const engagementScore = turnsScore * 0.4 + frequencyScore * 0.3 + depthScore * 0.3

    // Conversation balance (0-1, where 0.5 is perfectly balanced)
    const balance = totalMessages > 0 ? Math.abs(0.5 - userMessages.length / totalMessages) : 0
    const balanceScore = (1 - balance * 2) * 100 // Convert to 0-100

    // Calculate interruption rate (percentage of responses interrupted)
    const interruptionRate =
      assistantMessages.length > 0 ? (interruptions / assistantMessages.length) * 100 : 0

    // Session length in minutes
    const sessionLengthMinutes = session.duration / 60000

    // Return metrics matching EngagementMetrics interface
    const metrics = {
      // Required EngagementMetrics fields
      interruption_rate: interruptionRate,
      session_length_minutes: sessionLengthMinutes,

      // Additional metadata for detailed engagement insights
      metadata: {
        total_interruptions: interruptions,
        total_responses: assistantMessages.length,
        improvement_tips: this.generateImprovementTips(
          interruptionRate,
          engagementScore,
          balanceScore,
          turns
        ),

        // Detailed engagement statistics
        engagement_score: engagementScore,
        total_messages: totalMessages,
        user_messages: userMessages.length,
        assistant_messages: assistantMessages.length,
        turns,
        conversation_balance: balanceScore,
        user_message_ratio: totalMessages > 0 ? (userMessages.length / totalMessages) * 100 : 0,
        assistant_message_ratio:
          totalMessages > 0 ? (assistantMessages.length / totalMessages) * 100 : 0,
        avg_time_between_messages: avgTimeBetweenMessages,
        avg_time_between_messages_seconds: avgTimeBetweenMessages / 1000,
        avg_user_message_length: avgUserMessageLength,
        avg_user_message_words: Math.round(avgUserMessageLength / 5),
        messages_per_minute: session.duration > 0 ? totalMessages / (session.duration / 60000) : 0,
        turns_per_minute: session.duration > 0 ? turns / (session.duration / 60000) : 0,
        turns_score: turnsScore,
        frequency_score: frequencyScore,
        depth_score: depthScore,
      },
    }

    return metrics
  }

  private generateImprovementTips(
    interruptionRate: number,
    engagementScore: number,
    balanceScore: number,
    turns: number
  ): string[] {
    const tips: string[] = []

    if (interruptionRate > 30) {
      tips.push(
        'High interruption rate - consider letting the model complete responses before redirecting'
      )
    } else if (interruptionRate < 10) {
      tips.push('Low interruption rate - good flow and minimal redirections')
    }

    if (engagementScore > 75) {
      tips.push('High engagement! Good back-and-forth conversation with detailed inputs')
    } else if (engagementScore < 40) {
      tips.push('Low engagement - try more detailed messages and questions')
    }

    if (balanceScore < 50) {
      tips.push('Unbalanced conversation - aim for more equal turns between user and assistant')
    }

    if (turns < 3) {
      tips.push('Short session - longer conversations often yield better results')
    } else if (turns > 20) {
      tips.push('Extended session with many exchanges - great for complex tasks')
    }

    return tips
  }
}
