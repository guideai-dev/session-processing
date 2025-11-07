/**
 * JSONL Validation Runner
 *
 * Processes canonical JSONL files line-by-line and generates validation reports.
 */

import {
	validateCanonicalMessage,
	validateSession,
	type ValidationResult,
	type SessionValidationResult,
	type CanonicalMessage
} from '@guideai-dev/types'

export interface JSONLValidationOptions {
	/** Skip lines that fail to parse as JSON */
	skipInvalidJSON?: boolean
	/** Maximum number of errors before stopping validation */
	maxErrors?: number
	/** Include warnings in the report */
	includeWarnings?: boolean
}

export interface JSONLValidationResult {
	/** Overall validation status */
	valid: boolean
	/** Total lines processed */
	totalLines: number
	/** Lines that parsed successfully */
	parsedLines: number
	/** Lines that failed JSON parsing */
	invalidJSONLines: number[]
	/** Messages that passed validation */
	validMessages: number
	/** Individual message validation results */
	messageResults: ValidationResult[]
	/** Session-wide validation result */
	sessionResult?: SessionValidationResult
	/** Errors encountered */
	errors: Array<{
		line: number
		message: string
		details?: unknown
	}>
}

/**
 * Parse a single JSONL line to a CanonicalMessage
 */
function parseJSONLLine(line: string, lineNumber: number): {
	success: boolean
	message?: CanonicalMessage
	error?: string
} {
	try {
		const parsed = JSON.parse(line)
		return { success: true, message: parsed }
	} catch (error) {
		return {
			success: false,
			error: `JSON parse error: ${error instanceof Error ? error.message : String(error)}`
		}
	}
}

/**
 * Validate a JSONL file content
 */
export function validateJSONL(
	content: string,
	options: JSONLValidationOptions = {}
): JSONLValidationResult {
	const {
		skipInvalidJSON = false,
		maxErrors = Number.POSITIVE_INFINITY,
		includeWarnings = true
	} = options

	const lines = content.split('\n').filter((line) => line.trim().length > 0)
	const result: JSONLValidationResult = {
		valid: true,
		totalLines: lines.length,
		parsedLines: 0,
		invalidJSONLines: [],
		validMessages: 0,
		messageResults: [],
		errors: []
	}

	const messages: CanonicalMessage[] = []
	let errorCount = 0

	// Process each line
	for (let i = 0; i < lines.length; i++) {
		const lineNumber = i + 1
		const line = lines[i]

		// Parse JSON
		const parseResult = parseJSONLLine(line, lineNumber)

		if (!parseResult.success) {
			result.invalidJSONLines.push(lineNumber)
			result.errors.push({
				line: lineNumber,
				message: parseResult.error || 'Unknown parse error'
			})

			if (!skipInvalidJSON) {
				result.valid = false
				errorCount++
				if (errorCount >= maxErrors) {
					break
				}
			}
			continue
		}

		result.parsedLines++
		const message = parseResult.message!

		// Validate message
		const validation = validateCanonicalMessage(message, lineNumber)
		result.messageResults.push(validation)

		if (validation.valid) {
			result.validMessages++
			messages.push(message)
		} else {
			result.valid = false
			errorCount += validation.errors.length

			// Add errors to global error list
			for (const error of validation.errors) {
				result.errors.push({
					line: lineNumber,
					message: `[${error.code}] ${error.message}`,
					details: error.details
				})
			}

			if (errorCount >= maxErrors) {
				break
			}
		}

		// Include warnings in error count if not including warnings
		if (!includeWarnings) {
			errorCount += validation.warnings.length
			if (errorCount >= maxErrors) {
				break
			}
		}
	}

	// Session-wide validation
	if (messages.length > 0) {
		result.sessionResult = validateSession(messages)

		// Update overall validity based on session validation
		if (!result.sessionResult.valid) {
			result.valid = false

			// Add session-level errors
			for (const error of result.sessionResult.errors) {
				result.errors.push({
					line: error.line || 0,
					message: `[${error.code}] ${error.message}`,
					details: error.details
				})
			}
		}
	}

	return result
}

/**
 * Generate a human-readable validation report
 */
export function generateValidationReport(
	result: JSONLValidationResult,
	options: { verbose?: boolean; colorize?: boolean } = {}
): string {
	const { verbose = false, colorize = false } = options

	const lines: string[] = []

	// Color helpers (ANSI codes)
	const colors = {
		green: (text: string) => (colorize ? `\u001b[32m${text}\u001b[0m` : text),
		red: (text: string) => (colorize ? `\u001b[31m${text}\u001b[0m` : text),
		yellow: (text: string) => (colorize ? `\u001b[33m${text}\u001b[0m` : text),
		cyan: (text: string) => (colorize ? `\u001b[36m${text}\u001b[0m` : text),
		bold: (text: string) => (colorize ? `\u001b[1m${text}\u001b[0m` : text)
	}

	// Header
	lines.push(colors.bold('=== Canonical JSONL Validation Report ==='))
	lines.push('')

	// Summary
	const status = result.valid ? colors.green('✓ VALID') : colors.red('✗ INVALID')
	lines.push(`Status: ${status}`)
	lines.push(`Total Lines: ${result.totalLines}`)
	lines.push(`Parsed Lines: ${result.parsedLines}`)
	lines.push(
		`Valid Messages: ${colors.green(String(result.validMessages))}/${result.parsedLines}`
	)

	if (result.invalidJSONLines.length > 0) {
		lines.push(
			`Invalid JSON Lines: ${colors.red(String(result.invalidJSONLines.length))}`
		)
	}

	// Session info
	if (result.sessionResult) {
		lines.push('')
		lines.push(colors.bold('Session Info:'))
		lines.push(`  Session ID: ${result.sessionResult.sessionId}`)
		lines.push(`  Provider: ${result.sessionResult.provider}`)
		lines.push(`  Messages: ${result.sessionResult.messageCount}`)
		if (result.sessionResult.duration) {
			const durationMin = Math.round(result.sessionResult.duration / 1000 / 60)
			lines.push(`  Duration: ${durationMin} minutes`)
		}
	}

	// Errors
	if (result.errors.length > 0) {
		lines.push('')
		lines.push(colors.bold(colors.red(`Errors (${result.errors.length}):`)))

		for (const error of result.errors.slice(0, verbose ? undefined : 10)) {
			lines.push(`  ${colors.red('✗')} Line ${error.line}: ${error.message}`)
			if (verbose && error.details) {
				lines.push(
					`    ${colors.cyan('Details:')} ${JSON.stringify(error.details, null, 2).split('\n').join('\n    ')}`
				)
			}
		}

		if (!verbose && result.errors.length > 10) {
			lines.push(
				`  ${colors.yellow(`... and ${result.errors.length - 10} more errors`)}`
			)
			lines.push(
				`  ${colors.cyan('(use --verbose to see all errors)')}`
			)
		}
	}

	// Warnings
	if (result.sessionResult && result.sessionResult.warnings.length > 0) {
		lines.push('')
		lines.push(
			colors.bold(
				colors.yellow(`Warnings (${result.sessionResult.warnings.length}):`)
			)
		)

		for (const warning of result.sessionResult.warnings.slice(
			0,
			verbose ? undefined : 5
		)) {
			lines.push(
				`  ${colors.yellow('⚠')} Line ${warning.line || '?'}: ${warning.message}`
			)
			if (verbose && warning.details) {
				lines.push(
					`    ${colors.cyan('Details:')} ${JSON.stringify(warning.details, null, 2).split('\n').join('\n    ')}`
				)
			}
		}

		if (!verbose && result.sessionResult.warnings.length > 5) {
			lines.push(
				`  ${colors.yellow(`... and ${result.sessionResult.warnings.length - 5} more warnings`)}`
			)
		}
	}

	// Tool chain issues
	if (
		result.sessionResult &&
		result.sessionResult.toolChainIssues.length > 0
	) {
		lines.push('')
		lines.push(
			colors.bold(
				colors.yellow(
					`Tool Chain Issues (${result.sessionResult.toolChainIssues.length}):`
				)
			)
		)

		for (const issue of result.sessionResult.toolChainIssues.slice(
			0,
			verbose ? undefined : 5
		)) {
			const icon = issue.severity === 'error' ? colors.red('✗') : colors.yellow('⚠')
			lines.push(
				`  ${icon} Line ${issue.line || '?'}: ${issue.message}`
			)
		}

		if (!verbose && result.sessionResult.toolChainIssues.length > 5) {
			lines.push(
				`  ${colors.yellow(`... and ${result.sessionResult.toolChainIssues.length - 5} more issues`)}`
			)
		}
	}

	// Footer
	lines.push('')
	if (result.valid) {
		lines.push(colors.green(colors.bold('✓ Validation passed!')))
	} else {
		lines.push(colors.red(colors.bold('✗ Validation failed!')))
	}

	return lines.join('\n')
}
