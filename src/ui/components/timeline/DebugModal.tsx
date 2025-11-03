/**
 * DebugModal - Modal for displaying raw JSONL message data
 * Useful for debugging session processing issues
 */

import { CheckIcon, ClipboardIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import type { BaseSessionMessage } from '../../utils/sessionTypes.js'

interface DebugModalProps {
  isOpen: boolean
  onClose: () => void
  message: BaseSessionMessage
  messageDisplayType?: string
}

export function DebugModal({ isOpen, onClose, message, messageDisplayType }: DebugModalProps) {
  const [copySuccess, setCopySuccess] = useState(false)

  const handleCopyToClipboard = async () => {
    try {
      const jsonString = JSON.stringify(message, null, 2)
      await navigator.clipboard.writeText(jsonString)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      alert('Failed to copy to clipboard. Please try again.')
    }
  }

  if (!isOpen) return null

  const jsonString = JSON.stringify(message, null, 2)

  return (
    <div className="modal modal-open">
      <div className="modal-box w-full h-full max-w-full md:max-w-6xl md:h-auto max-h-full md:max-h-[90vh] rounded-none md:rounded-2xl overflow-hidden m-0! md:m-auto! top-0! md:top-auto! flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-bold">Debug: Raw JSONL Message</h2>
            <div className="text-sm text-base-content/60 mt-1">
              Message ID:{' '}
              <code className="text-xs bg-base-200 px-1 py-0.5 rounded">{message.id}</code>
              {messageDisplayType && (
                <span className="ml-3">
                  Display Type:{' '}
                  <code className="text-xs bg-base-200 px-1 py-0.5 rounded">
                    {messageDisplayType}
                  </code>
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="btn btn-sm btn-ghost gap-2"
              disabled={copySuccess}
            >
              {copySuccess ? (
                <>
                  <CheckIcon className="w-4 h-4 text-success" />
                  Copied!
                </>
              ) : (
                <>
                  <ClipboardIcon className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
            <button type="button" onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* JSON Content */}
        <div className="flex-1 overflow-auto bg-base-200 rounded-lg p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap break-words">{jsonString}</pre>
        </div>

        {/* Footer Info */}
        <div className="mt-4 p-3 bg-info/10 rounded-lg text-xs text-info flex-shrink-0">
          <p className="font-semibold mb-1">💡 Debugging Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-info/80">
            <li>
              Check the <code className="bg-base-200 px-1 rounded">type</code> field to understand
              message classification
            </li>
            <li>
              Verify <code className="bg-base-200 px-1 rounded">content</code> structure matches
              expected format
            </li>
            <li>
              Look for <code className="bg-base-200 px-1 rounded">metadata</code> to debug
              provider-specific issues
            </li>
            <li>
              Compare <code className="bg-base-200 px-1 rounded">timestamp</code> values to identify
              ordering issues
            </li>
          </ul>
        </div>
      </div>

      {/* Backdrop */}
      <div className="modal-backdrop bg-black/70" onClick={onClose} />
    </div>
  )
}
