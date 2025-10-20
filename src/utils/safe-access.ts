/**
 * Safe property access utilities for unknown objects
 * Provides type-safe ways to access properties on loosely-typed objects
 */

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Check if object has a specific property
 */
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isObject(obj) && key in obj
}

/**
 * Safely get a string property from an object
 */
export function getString(obj: unknown, key: string): string | undefined {
  if (hasProperty(obj, key) && typeof obj[key] === 'string') {
    return obj[key]
  }
  return undefined
}

/**
 * Safely get a number property from an object
 */
export function getNumber(obj: unknown, key: string): number | undefined {
  if (hasProperty(obj, key) && typeof obj[key] === 'number') {
    return obj[key]
  }
  return undefined
}

/**
 * Safely get a boolean property from an object
 */
export function getBoolean(obj: unknown, key: string): boolean | undefined {
  if (hasProperty(obj, key) && typeof obj[key] === 'boolean') {
    return obj[key]
  }
  return undefined
}

/**
 * Safely get an object property from an object
 */
export function getObject(obj: unknown, key: string): Record<string, unknown> | undefined {
  if (hasProperty(obj, key) && isObject(obj[key])) {
    return obj[key] as Record<string, unknown>
  }
  return undefined
}

/**
 * Safely get an array property from an object
 */
export function getArray(obj: unknown, key: string): unknown[] | undefined {
  if (hasProperty(obj, key) && Array.isArray(obj[key])) {
    return obj[key] as unknown[]
  }
  return undefined
}

/**
 * Safely get any property from an object
 */
export function get(obj: unknown, key: string): unknown {
  if (hasProperty(obj, key)) {
    return obj[key]
  }
  return undefined
}

/**
 * Type guard for checking if array contains objects with specific type field
 */
export function isArrayOfType<T extends string>(
  arr: unknown,
  typeValue: T
): arr is Array<{ type: T }> {
  return (
    Array.isArray(arr) &&
    arr.some(item => isObject(item) && hasProperty(item, 'type') && item.type === typeValue)
  )
}
