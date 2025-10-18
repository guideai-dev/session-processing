// Gemini uses the same task implementations as Claude
// since they work with the generic ParsedSession format
export {
  SessionSummaryTask,
  QualityAssessmentTask,
  IntentExtractionTask,
  SessionPhaseAnalysisTask,
} from '../../claude/tasks/index.js'
