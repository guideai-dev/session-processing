/**
 * MetricsOverview - Main metrics display component
 *
 * CONVERTED TO PROPS-BASED: This component now accepts metrics data as props
 * instead of fetching via hooks. The parent component should handle data fetching.
 */

import { MetricCard } from "./MetricCard.js";
import { MetricSection } from "./MetricSection.js";

// Type definition for session metrics UI data
export interface SessionMetricsUI {
  createdAt?: string | null
  usage?: {
    readWriteRatio?: string | null
    inputClarityScore?: string | null
    improvementTips?: string[] | null
  }
  error?: {
    errorCount?: number | null
    fatalErrors?: number | null
    recoveryAttempts?: number | null
    errorTypes?: string[] | null
    lastErrorMessage?: string | null
    improvementTips?: string[] | null
  }
  engagement?: {
    interruptionRate?: string | null
    sessionLengthMinutes?: string | null
    improvementTips?: string[] | null
  }
  quality?: {
    taskSuccessRate?: string | null
    iterationCount?: number | null
    processQualityScore?: string | null
    usedPlanMode?: boolean | null
    exitPlanModeCount?: number | null
    usedTodoTracking?: boolean | null
    todoWriteCount?: number | null
    overTopAffirmations?: number | null
    overTopAffirmationsPhrases?: string[] | null
    improvementTips?: string[] | null
  }
  performance?: {
    responseLatencyMs?: string | null
    taskCompletionTimeMs?: string | null
    improvementTips?: string[] | null
  }
  gitDiff?: {
    totalFiles?: number | null
    linesAdded?: number | null
    linesRemoved?: number | null
    linesModified?: number | null
    netLines?: number | null
    linesReadPerChanged?: string | null
    readsPerFile?: string | null
    linesPerMinute?: string | null
    linesPerTool?: string | null
    improvementTips?: string[] | null
  }
}

interface MetricsOverviewProps {
  sessionId: string
  metrics?: SessionMetricsUI | null
  isLoading?: boolean
  error?: Error | null
  onProcessSession?: () => void
  onCancelProcessing?: () => void
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null
  isProcessing?: boolean
  isCancelling?: boolean
  aiModelSummary?: string | null
  aiModelQualityScore?: number | null
  aiModelMetadata?: any | null
}

export function MetricsOverview({
  sessionId,
  metrics,
  isLoading = false,
  error = null,
  onProcessSession,
  onCancelProcessing,
  processingStatus,
  isProcessing = false,
  isCancelling = false,
  aiModelSummary,
  aiModelQualityScore,
  aiModelMetadata,
}: MetricsOverviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-base-content/70">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Failed to load metrics: {error.message}</span>
      </div>
    );
  }

  if (!metrics) {
    // If no processing handlers provided, this is a metrics-only session
    const isMetricsOnly = !onProcessSession && !onCancelProcessing

    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <svg
            className="w-16 h-16 mx-auto text-base-content/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Metrics Available</h3>
        <p className="text-base-content/70 mb-6">
          {isMetricsOnly
            ? 'This session does not have a transcript file. Metrics cannot be generated for metrics-only sessions.'
            : 'This session hasn\'t been processed yet. Process it to generate comprehensive metrics.'}
        </p>
        {(onProcessSession || onCancelProcessing) && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isProcessing || processingStatus === 'processing' ? (
              <>
                {onCancelProcessing && (
                  <button
                    onClick={onCancelProcessing}
                    className="btn btn-error"
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Cancelling...
                      </>
                    ) : (
                      'Cancel Processing'
                    )}
                  </button>
                )}
                <button className="btn btn-primary" disabled>
                  <span className="loading loading-spinner loading-sm"></span>
                  Processing...
                </button>
              </>
            ) : (
              onProcessSession && (
                <button
                  onClick={onProcessSession}
                  className="btn btn-primary"
                >
                  Process Session
                </button>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Assessment Section - At the top */}
      {(aiModelSummary || aiModelQualityScore !== null || aiModelMetadata) && (
        <MetricSection
          title="AI Assessment"
          subtitle="AI-generated quality analysis and session summary"
          icon="🤖"
        >
          <div className="space-y-4">
            {/* Top Row: Score + Summary */}
            {(aiModelQualityScore !== null && aiModelQualityScore !== undefined) || aiModelSummary ? (
              <div className="bg-base-100 border border-base-300 rounded-lg p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {aiModelQualityScore !== null && aiModelQualityScore !== undefined && (
                    <div className="bg-base-200 rounded-lg p-4 md:w-1/4 flex-shrink-0">
                      <div className="text-xs text-base-content/60 mb-1">Quality Score</div>
                      <div className={`text-3xl font-bold ${
                        aiModelQualityScore >= 80 ? 'text-success' :
                        aiModelQualityScore >= 60 ? 'text-warning' :
                        'text-error'
                      }`}>
                        {aiModelQualityScore}%
                      </div>
                      <div className="text-xs text-base-content/60 mt-1">
                        {aiModelQualityScore >= 80 ? 'Excellent session quality' :
                         aiModelQualityScore >= 60 ? 'Good session quality' :
                         'Room for improvement'}
                      </div>
                    </div>
                  )}
                  {aiModelSummary && (
                    <div className="bg-base-200 rounded-lg p-4 flex-1">
                      <div className="text-xs font-semibold mb-2 text-base-content/60">Summary</div>
                      <div className="text-sm leading-relaxed">{aiModelSummary}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Bottom Row: Improvements + Strengths */}
            {aiModelMetadata && aiModelMetadata['quality-assessment'] && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Improvements */}
                {aiModelMetadata['quality-assessment'].improvements && aiModelMetadata['quality-assessment'].improvements.length > 0 && (
                  <div className="bg-base-100 border border-base-300 rounded-lg p-4">
                    <div className="text-sm font-semibold mb-3 text-base-content/80">Areas for Improvement</div>
                    <ul className="space-y-2">
                      {aiModelMetadata['quality-assessment'].improvements.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-warning mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strengths */}
                {aiModelMetadata['quality-assessment'].strengths && aiModelMetadata['quality-assessment'].strengths.length > 0 && (
                  <div className="bg-base-100 border border-base-300 rounded-lg p-4">
                    <div className="text-sm font-semibold mb-3 text-base-content/80">Strengths</div>
                    <ul className="space-y-2">
                      {aiModelMetadata['quality-assessment'].strengths.map((item: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-success mt-1">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Additional Metadata (Intent Extraction, etc.) */}
            {aiModelMetadata && aiModelMetadata['intent-extraction'] && (
              <div className="card bg-base-100 border border-base-300 p-4">
                <h5 className="font-semibold mb-3">Intent Extraction</h5>
                <div className="space-y-3">
                  {aiModelMetadata['intent-extraction'].taskType && (
                    <div>
                      <div className="text-xs text-base-content/60 mb-1">Task Type</div>
                      <div className="badge badge-primary">{aiModelMetadata['intent-extraction'].taskType.replace(/_/g, ' ')}</div>
                    </div>
                  )}
                  {aiModelMetadata['intent-extraction'].primaryGoal && (
                    <div>
                      <div className="text-xs text-base-content/60 mb-1">Primary Goal</div>
                      <div className="text-sm">{aiModelMetadata['intent-extraction'].primaryGoal}</div>
                    </div>
                  )}
                  {aiModelMetadata['intent-extraction'].technologies && aiModelMetadata['intent-extraction'].technologies.length > 0 && (
                    <div>
                      <div className="text-xs text-base-content/60 mb-1">Technologies</div>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(aiModelMetadata['intent-extraction'].technologies)
                          ? aiModelMetadata['intent-extraction'].technologies.map((tech: string, idx: number) => (
                              <span key={idx} className="badge badge-ghost">{tech}</span>
                            ))
                          : Object.entries(aiModelMetadata['intent-extraction'].technologies).map(([key, val]: [string, any]) => (
                              <span key={key} className="badge badge-ghost">{val}</span>
                            ))
                        }
                      </div>
                    </div>
                  )}
                  {aiModelMetadata['intent-extraction'].challenges && aiModelMetadata['intent-extraction'].challenges.length > 0 && (
                    <div>
                      <div className="text-xs text-base-content/60 mb-1">Challenges</div>
                      {Array.isArray(aiModelMetadata['intent-extraction'].challenges) ? (
                        <ul className="space-y-1">
                          {aiModelMetadata['intent-extraction'].challenges.map((challenge: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-primary mt-1">•</span>
                              <span>{challenge}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm">{aiModelMetadata['intent-extraction'].challenges}</div>
                      )}
                    </div>
                  )}
                  {aiModelMetadata['intent-extraction'].secondaryGoals && aiModelMetadata['intent-extraction'].secondaryGoals.length > 0 && (
                    <div>
                      <div className="text-xs text-base-content/60 mb-1">Secondary Goals</div>
                      {Array.isArray(aiModelMetadata['intent-extraction'].secondaryGoals) ? (
                        <ul className="space-y-1">
                          {aiModelMetadata['intent-extraction'].secondaryGoals.map((goal: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-primary mt-1">•</span>
                              <span>{goal}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm">{aiModelMetadata['intent-extraction'].secondaryGoals}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </MetricSection>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">Session Metrics</h2>
          <p className="text-xs md:text-sm text-base-content/70">
            Last updated:{" "}
            {new Date(metrics.createdAt || "").toLocaleString()}
          </p>
        </div>
      </div>

      {/* Usage Metrics */}
      {metrics.usage && (metrics.usage.readWriteRatio || metrics.usage.inputClarityScore) && (
        <MetricSection
          title="Usage Efficiency"
          subtitle="AI navigation efficiency and input quality analysis"
          icon="🔧"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <MetricCard
                label="Read/Write Ratio"
                value={metrics.usage.readWriteRatio ? parseFloat(metrics.usage.readWriteRatio) : undefined}
                suffix=":1"
                tooltip="Reads per write (lower is better - high means AI is 'lost')"
              />
              <MetricCard
                label="Input Clarity Score"
                value={metrics.usage.inputClarityScore ? parseFloat(metrics.usage.inputClarityScore) : undefined}
                type="percentage"
                tooltip="Technical terms and code snippets density"
              />
            </div>

            {/* Improvement Tips */}
            {metrics.usage.improvementTips && metrics.usage.improvementTips.length > 0 && (
                <div className="card bg-base-100 p-4">
                  <h4 className="font-semibold mb-3">
                    💡 Improvement Tips
                  </h4>
                  <ul className="text-sm space-y-1">
                    {metrics.usage.improvementTips.map(
                      (tip: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <span className="text-primary mr-2">•</span>
                          {tip}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
          </div>
        </MetricSection>
      )}

      {/* Error Metrics */}
      {metrics.error && (metrics.error.errorCount !== undefined && metrics.error.errorCount !== null) && (
        <MetricSection
          title="Errors & Recovery"
          subtitle="Error tracking and recovery patterns"
          icon="⚠️"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <MetricCard
                label="Error Count"
                value={metrics.error.errorCount}
                tooltip="Total number of errors encountered"
              />
              <MetricCard
                label="Fatal Errors"
                value={metrics.error.fatalErrors || 0}
                tooltip="Critical errors that stopped progress"
              />
              <MetricCard
                label="Recovery Attempts"
                value={metrics.error.recoveryAttempts || 0}
                tooltip="Number of times AI retried after errors"
              />
              <MetricCard
                label="Error Types"
                value={metrics.error.errorTypes?.length || 0}
                tooltip="Unique categories of errors"
              />
            </div>

            {/* Error Types List */}
            {metrics.error.errorTypes && metrics.error.errorTypes.length > 0 && (
              <div className="card bg-base-100 p-4">
                <h4 className="font-semibold mb-3">Error Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {metrics.error.errorTypes.map((errorType: string, index: number) => (
                    <span key={index} className="badge badge-error badge-outline">
                      {errorType.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Last Error Message */}
            {metrics.error.lastErrorMessage && (
              <div className="card bg-base-100 p-4">
                <h4 className="font-semibold mb-2 text-error">Last Error</h4>
                <p className="text-sm font-mono bg-base-200 p-2 rounded">
                  {metrics.error.lastErrorMessage}
                </p>
              </div>
            )}

            {/* Improvement Tips */}
            {metrics.error.improvementTips && metrics.error.improvementTips.length > 0 && (
              <div className="card bg-base-100 p-4">
                <h4 className="font-semibold mb-3">💡 Improvement Tips</h4>
                <ul className="text-sm space-y-1">
                  {metrics.error.improvementTips.map((tip: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </MetricSection>
      )}

      {/* Engagement Metrics */}
      {metrics.engagement && (metrics.engagement.interruptionRate || metrics.engagement.sessionLengthMinutes) && (
        <MetricSection
          title="Engagement"
          subtitle="User patience and session duration patterns"
          icon="👥"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <MetricCard
                label="Interruption Rate"
                value={metrics.engagement.interruptionRate ? parseFloat(metrics.engagement.interruptionRate) : undefined}
                type="percentage"
                tooltip="Percentage of responses interrupted by user"
              />
              <MetricCard
                label="Session Length"
                value={metrics.engagement.sessionLengthMinutes ? parseFloat(metrics.engagement.sessionLengthMinutes) : undefined}
                suffix=" min"
                tooltip="Active interaction time in minutes"
              />
            </div>

            {/* Improvement Tips */}
            {metrics.engagement.improvementTips && metrics.engagement.improvementTips.length > 0 && (
              <div className="card bg-base-100 p-4">
                <h4 className="font-semibold mb-3">💡 Improvement Tips</h4>
                <ul className="text-sm space-y-1">
                  {metrics.engagement.improvementTips.map((tip: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </MetricSection>
      )}

      {/* Quality Metrics */}
      {metrics.quality && (
        <MetricSection
          title="Quality"
          subtitle="Task success rates and AI usage process quality"
          icon="✓"
        >
          <div className="space-y-4">
            {/* Plan Mode Usage - Prominent Display */}
            <div className="card bg-base-100 border border-base-300 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`text-2xl ${metrics.quality.usedPlanMode ? "text-green-500" : "text-gray-400"}`}
                  >
                    {metrics.quality.usedPlanMode ? "🎯" : "⚪"}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Used Plan Mode</h4>
                    <p className="text-xs text-base-content/70">
                      {metrics.quality.usedPlanMode
                        ? "Excellent! Used proper planning discipline"
                        : "Consider using plan mode for complex tasks"}
                    </p>
                  </div>
                </div>
                <div
                  className={`badge ${metrics.quality.usedPlanMode ? "badge-success" : "badge-ghost"} font-medium`}
                >
                  {metrics.quality.usedPlanMode ? "✓ Yes" : "✗ No"}
                </div>
              </div>
              {metrics.quality.exitPlanModeCount &&
                metrics.quality.exitPlanModeCount > 0 && (
                  <div className="text-xs text-base-content/60 mt-2">
                    Used ExitPlanMode{" "}
                    {metrics.quality.exitPlanModeCount}{" "}
                    time(s)
                  </div>
                )}
            </div>

            {/* Todo Tracking Usage */}
            <div className="card bg-base-100 border border-base-300 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`text-lg ${metrics.quality.usedTodoTracking ? "text-green-500" : "text-gray-400"}`}
                  >
                    {metrics.quality.usedTodoTracking ? "📋" : "⚪"}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Todo Tracking</h4>
                    <p className="text-xs text-base-content/70">
                      {metrics.quality.usedTodoTracking
                        ? "Great task organization!"
                        : "TodoWrite helps track progress"}
                    </p>
                  </div>
                </div>
                <div
                  className={`badge ${metrics.quality.usedTodoTracking ? "badge-success" : "badge-ghost"}`}
                >
                  {metrics.quality.usedTodoTracking
                    ? "✓ Yes"
                    : "✗ No"}
                </div>
              </div>
              {metrics.quality.todoWriteCount &&
                metrics.quality.todoWriteCount > 0 && (
                  <div className="text-xs text-base-content/60 mt-1">
                    Used TodoWrite{" "}
                    {metrics.quality.todoWriteCount}{" "}
                    time(s)
                  </div>
                )}
            </div>

            {/* Over the Top Affirmations Card */}
            {metrics.quality.overTopAffirmations !== undefined && metrics.quality.overTopAffirmations !== null && (
              <div className="card bg-base-100 border border-base-300 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`text-lg ${metrics.quality.overTopAffirmations > 0 ? "text-yellow-500" : "text-green-500"}`}
                    >
                      {metrics.quality.overTopAffirmations > 0
                        ? "🎭"
                        : "✅"}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">
                        Over-the-Top Affirmations
                      </h4>
                      <p className="text-xs text-base-content/70">
                        {metrics.quality.overTopAffirmations === 0
                          ? "Professional tone maintained"
                          : `${metrics.quality.overTopAffirmations} excessive affirmations detected`}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`badge ${metrics.quality.overTopAffirmations === 0 ? "badge-success" : "badge-warning"}`}
                  >
                    {metrics.quality.overTopAffirmations}
                  </div>
                </div>
                {metrics.quality.overTopAffirmationsPhrases &&
                  metrics.quality.overTopAffirmationsPhrases.length > 0 && (
                    <div className="text-xs text-base-content/60 mt-1">
                      Phrases:{" "}
                      {metrics.quality.overTopAffirmationsPhrases.join(", ")}
                    </div>
                  )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <MetricCard
                label="Task Success Rate"
                value={metrics.quality.taskSuccessRate ? parseFloat(metrics.quality.taskSuccessRate) : undefined}
                type="percentage"
                tooltip="Percentage of operations that succeeded"
              />
              <MetricCard
                label="Iteration Count"
                value={metrics.quality.iterationCount}
                tooltip="Number of refinement cycles needed"
              />
              <MetricCard
                label="Process Quality Score"
                value={metrics.quality.processQualityScore ? parseFloat(metrics.quality.processQualityScore) : undefined}
                type="percentage"
                tooltip="Score for good AI usage practices (plan mode gives 30pts, todo tracking gives 20pts)"
              />
              <MetricCard
                label="Affirmations"
                value={metrics.quality.overTopAffirmations || 0}
                tooltip="Count of over-the-top affirmations like 'You're absolutely right!'"
              />
            </div>

            {/* Improvement Tips */}
            {metrics.quality.improvementTips && metrics.quality.improvementTips.length > 0 && (
              <div className="card bg-base-100 p-4">
                <h4 className="font-semibold mb-3">💡 Improvement Tips</h4>
                <ul className="text-sm space-y-1">
                  {metrics.quality.improvementTips.map((tip: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </MetricSection>
      )}

      {/* Performance Metrics */}
      {metrics.performance && (metrics.performance.responseLatencyMs || metrics.performance.taskCompletionTimeMs) && (
        <MetricSection
          title="Performance"
          subtitle="AI response speed and task completion efficiency"
          icon="⚡"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              <MetricCard
                label="Response Latency"
                value={metrics.performance.responseLatencyMs ? parseFloat(metrics.performance.responseLatencyMs) : undefined}
                type="duration"
                tooltip="Average time to respond to user messages"
              />
              <MetricCard
                label="Task Completion Time"
                value={metrics.performance.taskCompletionTimeMs ? parseFloat(metrics.performance.taskCompletionTimeMs) : undefined}
                type="duration"
                tooltip="Total time to complete user's goal"
              />
            </div>

            {/* Improvement Tips */}
            {metrics.performance.improvementTips && metrics.performance.improvementTips.length > 0 && (
              <div className="card bg-base-100 p-4">
                <h4 className="font-semibold mb-3">💡 Improvement Tips</h4>
                <ul className="text-sm space-y-1">
                  {metrics.performance.improvementTips.map((tip: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </MetricSection>
      )}

      {/* Git Diff Metrics - Desktop Only */}
      {metrics.gitDiff && (metrics.gitDiff.totalFiles !== undefined && metrics.gitDiff.totalFiles !== null && metrics.gitDiff.totalFiles > 0) && (
        <MetricSection
          title="Code Changes"
          subtitle="Git diff analysis and navigation efficiency"
          icon="📊"
        >
          <div className="space-y-4">
            {/* Core Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <MetricCard
                label="Files Changed"
                value={metrics.gitDiff.totalFiles}
                tooltip="Total number of files modified or added"
              />
              <MetricCard
                label="Lines Added"
                value={metrics.gitDiff.linesAdded || 0}
                tooltip="Total lines added across all files"
              />
              <MetricCard
                label="Lines Removed"
                value={metrics.gitDiff.linesRemoved || 0}
                tooltip="Total lines deleted across all files"
              />
              <MetricCard
                label="Net Change"
                value={metrics.gitDiff.netLines || 0}
                tooltip="Lines added minus lines removed (growth or reduction)"
              />
            </div>

            <div className="divider text-sm">Navigation Efficiency</div>

            {/* Efficiency Ratios */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <MetricCard
                label="Lines Read / Changed"
                value={metrics.gitDiff.linesReadPerChanged ? parseFloat(metrics.gitDiff.linesReadPerChanged) : undefined}
                suffix=":1"
                tooltip="Lines read per line changed - lower is better (efficient navigation)"
              />
              <MetricCard
                label="Reads / File"
                value={metrics.gitDiff.readsPerFile ? parseFloat(metrics.gitDiff.readsPerFile) : undefined}
                tooltip="Read operations per file changed - lower is better"
              />
              <MetricCard
                label="Lines/Min"
                value={metrics.gitDiff.linesPerMinute ? parseFloat(metrics.gitDiff.linesPerMinute) : undefined}
                tooltip="Code velocity - lines changed per minute"
              />
              <MetricCard
                label="Lines/Tool"
                value={metrics.gitDiff.linesPerTool ? parseFloat(metrics.gitDiff.linesPerTool) : undefined}
                tooltip="Lines changed per tool use - higher is better"
              />
            </div>

            {/* Improvement Tips */}
            {metrics.gitDiff.improvementTips && metrics.gitDiff.improvementTips.length > 0 && (
              <div className="card bg-base-100 p-4">
                <h4 className="font-semibold mb-3">💡 Improvement Tips</h4>
                <ul className="text-sm space-y-1">
                  {metrics.gitDiff.improvementTips.map((tip: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-primary mr-2">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </MetricSection>
      )}
    </div>
  );
}
