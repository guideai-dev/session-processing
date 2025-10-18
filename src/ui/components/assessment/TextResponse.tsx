import type { TextResponseProps } from './types'

export function TextResponse({
  value,
  onChange,
  placeholder,
  disabled = false,
}: TextResponseProps) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={4}
      className="textarea textarea-bordered w-full text-base resize-none focus:textarea-primary"
    />
  )
}
