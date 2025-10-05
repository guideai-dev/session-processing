/**
 * Example: Session Phase Analysis
 * 
 * This example demonstrates how to use the SessionPhaseAnalysisTask
 * to analyze AI coding sessions and break them into meaningful phases.
 */

import { 
  ClaudeModelAdapter, 
  SessionPhaseAnalysisTask,
  type SessionPhaseAnalysis 
} from '@guideai-dev/session-processing/ai-models'
import type { ParsedSession } from '@guideai-dev/session-processing/processors'

/**
 * Example 1: Basic Usage
 * Analyze a session and get phase breakdown
 */
async function analyzeSessionPhases(
  apiKey: string,
  parsedSession: ParsedSession,
  userInfo: { name: string; username: string; email: string }
): Promise<SessionPhaseAnalysis | null> {
  // Initialize Claude adapter
  const adapter = new ClaudeModelAdapter({
    apiKey,
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 1.0
  })

  // Create and register the phase analysis task
  const phaseAnalysisTask = new SessionPhaseAnalysisTask()
  adapter.registerTask(phaseAnalysisTask)

  // Prepare context
  const context = {
    sessionId: parsedSession.sessionId,
    tenantId: 'example-tenant',
    userId: 'example-user',
    provider: parsedSession.provider,
    session: parsedSession,
    user: userInfo
  }

  // Execute the task
  console.log('Analyzing session phases...')
  const result = await adapter.executeTask(phaseAnalysisTask, context)

  if (result.success) {
    const phaseAnalysis = result.output as SessionPhaseAnalysis
    
    console.log('\n✅ Phase Analysis Complete!')
    console.log(`Model: ${result.metadata.modelUsed}`)
    console.log(`Tokens Used: ${result.metadata.tokensUsed}`)
    console.log(`Processing Time: ${result.metadata.processingTime}ms`)
    console.log(`Cost: $${result.metadata.cost?.toFixed(4)}`)
    
    return phaseAnalysis
  } else {
    console.error('❌ Phase analysis failed:', result.metadata.error)
    return null
  }
}

/**
 * Example 2: Display Phase Analysis Results
 * Pretty print the phase analysis
 */
function displayPhaseAnalysis(analysis: SessionPhaseAnalysis): void {
  console.log('\n📊 Session Phase Analysis')
  console.log('─'.repeat(80))
  console.log(`Total Phases: ${analysis.totalPhases}`)
  console.log(`Total Steps: ${analysis.totalSteps}`)
  console.log(`Duration: ${Math.round(analysis.sessionDurationMs / 1000)}s`)
  console.log(`Pattern: ${analysis.pattern}`)
  console.log('─'.repeat(80))

  analysis.phases.forEach((phase, index) => {
    const duration = Math.round(phase.durationMs / 1000)
    const emoji = getPhaseEmoji(phase.phaseType)
    
    console.log(`\n${index + 1}. ${emoji} ${formatPhaseType(phase.phaseType)}`)
    console.log(`   Steps: ${phase.startStep}-${phase.endStep} (${phase.stepCount} messages)`)
    console.log(`   Duration: ${duration}s`)
    console.log(`   Summary: ${phase.summary}`)
    if (phase.timestamp) {
      console.log(`   Started: ${new Date(phase.timestamp).toLocaleString()}`)
    }
  })
}

/**
 * Example 3: Store Phase Analysis
 * Store the analysis in a database (SQLite example)
 */
async function storePhaseAnalysis(
  sessionId: string,
  analysis: SessionPhaseAnalysis
): Promise<void> {
  // Example for SQLite (desktop app)
  // In real code, use your database client
  console.log('\n💾 Storing phase analysis...')
  
  const sql = `
    UPDATE agent_sessions 
    SET ai_model_phase_analysis = ?
    WHERE id = ?
  `
  
  console.log('SQL:', sql)
  console.log('Data:', JSON.stringify(analysis, null, 2))
  
  // await db.execute(sql, [JSON.stringify(analysis), sessionId])
  console.log('✅ Stored successfully!')
}

/**
 * Example 4: Query and Filter Phases
 * Find specific types of phases
 */
function findPhasesOfType(
  analysis: SessionPhaseAnalysis,
  phaseType: string
): typeof analysis.phases {
  return analysis.phases.filter(phase => phase.phaseType === phaseType)
}

function getLongestPhase(analysis: SessionPhaseAnalysis): typeof analysis.phases[0] | null {
  if (analysis.phases.length === 0) return null
  return analysis.phases.reduce((longest, current) => 
    current.durationMs > longest.durationMs ? current : longest
  )
}

/**
 * Example 5: Timeline Visualization
 * Create a simple ASCII timeline
 */
function visualizeTimeline(analysis: SessionPhaseAnalysis): void {
  console.log('\n📅 Timeline Visualization')
  console.log('─'.repeat(80))

  const maxWidth = 60
  const totalDuration = analysis.sessionDurationMs

  analysis.phases.forEach(phase => {
    const percentage = (phase.durationMs / totalDuration) * 100
    const barWidth = Math.max(1, Math.round((percentage / 100) * maxWidth))
    const bar = '█'.repeat(barWidth)
    const emoji = getPhaseEmoji(phase.phaseType)
    
    console.log(
      `${emoji} ${formatPhaseType(phase.phaseType).padEnd(20)} ` +
      `${bar} ${percentage.toFixed(1)}%`
    )
  })
}

/**
 * Example 6: Compare Sessions
 * Identify common patterns across sessions
 */
function compareSessionPatterns(
  analyses: SessionPhaseAnalysis[]
): { pattern: string; count: number }[] {
  const patternCounts = new Map<string, number>()

  analyses.forEach(analysis => {
    const count = patternCounts.get(analysis.pattern) || 0
    patternCounts.set(analysis.pattern, count + 1)
  })

  return Array.from(patternCounts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Helper: Get emoji for phase type
 */
function getPhaseEmoji(phaseType: string): string {
  const emojiMap: Record<string, string> = {
    'initial_specification': '📝',
    'analysis_planning': '🔍',
    'plan_modification': '✏️',
    'plan_agreement': '🤝',
    'execution': '⚡',
    'interruption': '🛑',
    'task_assignment': '📋',
    'completion': '✅',
    'correction': '🔧',
    'final_completion': '🎉',
    'other': '❓'
  }
  return emojiMap[phaseType] || '●'
}

/**
 * Helper: Format phase type for display
 */
function formatPhaseType(phaseType: string): string {
  return phaseType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Example 7: Complete Workflow
 * Full example putting it all together
 */
async function completeWorkflow() {
  // Mock data for demonstration
  const mockSession: ParsedSession = {
    sessionId: 'example-session-123',
    provider: 'claude-code',
    messages: [
      {
        id: '1',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        type: 'user',
        content: 'I want to add a session phase analysis feature to track coding session stages.'
      },
      {
        id: '2',
        timestamp: new Date('2024-01-15T10:02:00Z'),
        type: 'assistant',
        content: { 
          text: 'Let me analyze the requirements and create a plan...',
          toolUses: [{ name: 'str_replace_editor', id: 'tool1' }]
        }
      },
      // ... more messages
    ],
    startTime: new Date('2024-01-15T10:00:00Z'),
    endTime: new Date('2024-01-15T10:30:00Z'),
    duration: 1800000 // 30 minutes
  }

  const userInfo = {
    name: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com'
  }

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY environment variable not set')
    return
  }

  try {
    // Step 1: Analyze the session
    const analysis = await analyzeSessionPhases(apiKey, mockSession, userInfo)
    if (!analysis) return

    // Step 2: Display the results
    displayPhaseAnalysis(analysis)

    // Step 3: Visualize timeline
    visualizeTimeline(analysis)

    // Step 4: Find specific phases
    const executionPhases = findPhasesOfType(analysis, 'execution')
    console.log(`\n⚡ Found ${executionPhases.length} execution phase(s)`)

    const longestPhase = getLongestPhase(analysis)
    if (longestPhase) {
      console.log(
        `\n⏱️  Longest phase: ${formatPhaseType(longestPhase.phaseType)} ` +
        `(${Math.round(longestPhase.durationMs / 1000)}s)`
      )
    }

    // Step 5: Store the analysis
    await storePhaseAnalysis(mockSession.sessionId, analysis)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Export for use in other modules
export {
  analyzeSessionPhases,
  displayPhaseAnalysis,
  storePhaseAnalysis,
  findPhasesOfType,
  getLongestPhase,
  visualizeTimeline,
  compareSessionPatterns,
  formatPhaseType,
  getPhaseEmoji
}

// Run the complete workflow if executed directly
if (require.main === module) {
  completeWorkflow()
    .then(() => console.log('\n✨ Complete!'))
    .catch(error => console.error('Fatal error:', error))
}
