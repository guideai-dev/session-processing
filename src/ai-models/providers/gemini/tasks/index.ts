// Gemini uses the same task implementations as Claude
// since they work with the generic ParsedSession format
export {
  SessionSummaryTask,
  QualityAssessmentTask,
  IntentExtractionTask
} from '../../claude/tasks/index.js'
