/**
 * DateFilter - Date range filter component
 */

import { useState, useEffect } from 'react'

export type DateFilterOption =
  | 'all'
  | 'last24hrs'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'range'

export interface DateRange {
  from: string
  to: string
}

export interface DateFilterValue {
  option: DateFilterOption
  range?: DateRange
}

interface DateFilterProps {
  value: DateFilterValue
  onChange: (value: DateFilterValue) => void
}

function DateFilter({ value, onChange }: DateFilterProps) {
  const [showDatePickers, setShowDatePickers] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    if (value.option === 'range' && value.range) {
      setFromDate(value.range.from)
      setToDate(value.range.to)
      setShowDatePickers(true)
    } else {
      setShowDatePickers(false)
    }
  }, [value])

  const handleOptionChange = (option: DateFilterOption) => {
    if (option === 'range') {
      const today = new Date().toISOString().split('T')[0]
      const newRange = {
        from: fromDate || today,
        to: toDate || today,
      }
      setFromDate(newRange.from)
      setToDate(newRange.to)
      setShowDatePickers(true)
      onChange({ option, range: newRange })
    } else {
      setShowDatePickers(false)
      onChange({ option })
    }
  }

  const handleRangeChange = (from: string, to: string) => {
    const newRange = { from, to }
    onChange({ option: 'range', range: newRange })
  }

  const getOptionLabel = (option: DateFilterOption): string => {
    switch (option) {
      case 'all':
        return 'All Time'
      case 'last24hrs':
        return 'Last 24 hrs'
      case 'today':
        return 'Today'
      case 'yesterday':
        return 'Yesterday'
      case 'this-week':
        return 'This Week'
      case 'last-week':
        return 'Last Week'
      case 'range':
        return 'Range'
      default:
        return option
    }
  }

  const options: DateFilterOption[] = [
    'all',
    'last24hrs',
    'today',
    'yesterday',
    'this-week',
    'last-week',
    'range',
  ]

  return (
    <div className="space-y-2">
      {/* Date Filter Select */}
      <select
        value={value.option}
        onChange={e => handleOptionChange(e.target.value as DateFilterOption)}
        className="select select-sm select-bordered w-full"
      >
        {options.map(option => (
          <option key={option} value={option}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>

      {/* Date Range Pickers */}
      {showDatePickers && (
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <input
            type="date"
            value={fromDate}
            onChange={e => {
              setFromDate(e.target.value)
              handleRangeChange(e.target.value, toDate)
            }}
            className="input input-sm input-bordered flex-1"
            placeholder="From"
          />
          <span className="text-xs text-base-content/70 self-center">to</span>
          <input
            type="date"
            value={toDate}
            onChange={e => {
              setToDate(e.target.value)
              handleRangeChange(fromDate, e.target.value)
            }}
            className="input input-sm input-bordered flex-1"
            placeholder="To"
          />
        </div>
      )}
    </div>
  )
}

export default DateFilter
