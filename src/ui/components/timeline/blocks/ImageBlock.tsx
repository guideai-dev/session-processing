/**
 * ImageBlock - Renders image content with preview
 */

interface ImageBlockProps {
  content: string // data URL
  format?: string
}

export function ImageBlock({ content, format = 'png' }: ImageBlockProps) {
  return (
    <div className="bg-base-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <svg
          className="w-4 h-4 text-base-content/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span className="text-xs text-base-content/60 font-medium">Image</span>
      </div>
      <img
        src={content}
        alt="Content"
        className="max-w-full max-h-64 rounded border border-base-content/10 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => window.open(content)}
      />
      <div className="mt-2 text-xs text-base-content/50">
        Click to view full size • {format.toUpperCase()}
      </div>
    </div>
  )
}
