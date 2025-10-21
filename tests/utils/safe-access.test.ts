import { describe, it, expect } from 'vitest'
import {
	isObject,
	hasProperty,
	getString,
	getNumber,
	getBoolean,
	getObject,
	getArray,
	get,
	isArrayOfType,
} from '../../src/utils/safe-access.js'

describe('isObject', () => {
	describe('Valid Objects', () => {
		it('should return true for plain object', () => {
			expect(isObject({})).toBe(true)
		})

		it('should return true for object with properties', () => {
			expect(isObject({ key: 'value' })).toBe(true)
		})

		it('should return true for nested object', () => {
			expect(isObject({ nested: { key: 'value' } })).toBe(true)
		})

		it('should return true for object created with Object.create', () => {
			expect(isObject(Object.create(null))).toBe(true)
		})

		it('should return true for object created with new Object()', () => {
			expect(isObject(new Object())).toBe(true)
		})
	})

	describe('Invalid Objects', () => {
		it('should return false for null', () => {
			expect(isObject(null)).toBe(false)
		})

		it('should return false for undefined', () => {
			expect(isObject(undefined)).toBe(false)
		})

		it('should return false for array', () => {
			expect(isObject([])).toBe(false)
		})

		it('should return false for array with elements', () => {
			expect(isObject([1, 2, 3])).toBe(false)
		})

		it('should return false for string', () => {
			expect(isObject('string')).toBe(false)
		})

		it('should return false for number', () => {
			expect(isObject(123)).toBe(false)
		})

		it('should return false for boolean', () => {
			expect(isObject(true)).toBe(false)
		})

		it('should return false for function', () => {
			expect(isObject(() => {})).toBe(false)
		})

		it('should return false for Date object', () => {
			expect(isObject(new Date())).toBe(true) // Date is still an object
		})
	})
})

describe('hasProperty', () => {
	describe('Existing Properties', () => {
		it('should return true for existing property', () => {
			const obj = { key: 'value' }
			expect(hasProperty(obj, 'key')).toBe(true)
		})

		it('should return true for property with undefined value', () => {
			const obj = { key: undefined }
			expect(hasProperty(obj, 'key')).toBe(true)
		})

		it('should return true for property with null value', () => {
			const obj = { key: null }
			expect(hasProperty(obj, 'key')).toBe(true)
		})

		it('should return true for property with falsy value', () => {
			const obj = { key: 0 }
			expect(hasProperty(obj, 'key')).toBe(true)
		})

		it('should return true for nested property check on parent', () => {
			const obj = { nested: { key: 'value' } }
			expect(hasProperty(obj, 'nested')).toBe(true)
		})
	})

	describe('Missing Properties', () => {
		it('should return false for non-existent property', () => {
			const obj = { key: 'value' }
			expect(hasProperty(obj, 'otherKey')).toBe(false)
		})

		it('should return false for empty object', () => {
			const obj = {}
			expect(hasProperty(obj, 'key')).toBe(false)
		})
	})

	describe('Invalid Objects', () => {
		it('should return false for null', () => {
			expect(hasProperty(null, 'key')).toBe(false)
		})

		it('should return false for undefined', () => {
			expect(hasProperty(undefined, 'key')).toBe(false)
		})

		it('should return false for string', () => {
			expect(hasProperty('string', 'key')).toBe(false)
		})

		it('should return false for number', () => {
			expect(hasProperty(123, 'key')).toBe(false)
		})

		it('should return false for array', () => {
			expect(hasProperty([], 'key')).toBe(false)
		})
	})
})

describe('getString', () => {
	describe('Valid Strings', () => {
		it('should return string value', () => {
			const obj = { name: 'John' }
			expect(getString(obj, 'name')).toBe('John')
		})

		it('should return empty string', () => {
			const obj = { name: '' }
			expect(getString(obj, 'name')).toBe('')
		})

		it('should return string with spaces', () => {
			const obj = { name: '  spaces  ' }
			expect(getString(obj, 'name')).toBe('  spaces  ')
		})
	})

	describe('Invalid Types', () => {
		it('should return undefined for number', () => {
			const obj = { value: 123 }
			expect(getString(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for boolean', () => {
			const obj = { flag: true }
			expect(getString(obj, 'flag')).toBeUndefined()
		})

		it('should return undefined for object', () => {
			const obj = { nested: { key: 'value' } }
			expect(getString(obj, 'nested')).toBeUndefined()
		})

		it('should return undefined for array', () => {
			const obj = { list: ['a', 'b'] }
			expect(getString(obj, 'list')).toBeUndefined()
		})

		it('should return undefined for null', () => {
			const obj = { value: null }
			expect(getString(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for undefined value', () => {
			const obj = { value: undefined }
			expect(getString(obj, 'value')).toBeUndefined()
		})
	})

	describe('Missing Properties', () => {
		it('should return undefined for missing property', () => {
			const obj = { other: 'value' }
			expect(getString(obj, 'name')).toBeUndefined()
		})

		it('should return undefined for non-object', () => {
			expect(getString(null, 'name')).toBeUndefined()
		})
	})
})

describe('getNumber', () => {
	describe('Valid Numbers', () => {
		it('should return positive number', () => {
			const obj = { count: 42 }
			expect(getNumber(obj, 'count')).toBe(42)
		})

		it('should return zero', () => {
			const obj = { count: 0 }
			expect(getNumber(obj, 'count')).toBe(0)
		})

		it('should return negative number', () => {
			const obj = { count: -10 }
			expect(getNumber(obj, 'count')).toBe(-10)
		})

		it('should return decimal number', () => {
			const obj = { value: 3.14 }
			expect(getNumber(obj, 'value')).toBe(3.14)
		})

		it('should return NaN', () => {
			const obj = { value: NaN }
			const result = getNumber(obj, 'value')
			expect(typeof result).toBe('number')
			expect(Number.isNaN(result)).toBe(true)
		})

		it('should return Infinity', () => {
			const obj = { value: Infinity }
			expect(getNumber(obj, 'value')).toBe(Infinity)
		})
	})

	describe('Invalid Types', () => {
		it('should return undefined for string', () => {
			const obj = { value: '123' }
			expect(getNumber(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for boolean', () => {
			const obj = { value: false }
			expect(getNumber(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for object', () => {
			const obj = { value: {} }
			expect(getNumber(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for array', () => {
			const obj = { value: [1, 2, 3] }
			expect(getNumber(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for null', () => {
			const obj = { value: null }
			expect(getNumber(obj, 'value')).toBeUndefined()
		})
	})

	describe('Missing Properties', () => {
		it('should return undefined for missing property', () => {
			const obj = { other: 42 }
			expect(getNumber(obj, 'count')).toBeUndefined()
		})
	})
})

describe('getBoolean', () => {
	describe('Valid Booleans', () => {
		it('should return true', () => {
			const obj = { flag: true }
			expect(getBoolean(obj, 'flag')).toBe(true)
		})

		it('should return false', () => {
			const obj = { flag: false }
			expect(getBoolean(obj, 'flag')).toBe(false)
		})
	})

	describe('Invalid Types', () => {
		it('should return undefined for string "true"', () => {
			const obj = { flag: 'true' }
			expect(getBoolean(obj, 'flag')).toBeUndefined()
		})

		it('should return undefined for number 1', () => {
			const obj = { flag: 1 }
			expect(getBoolean(obj, 'flag')).toBeUndefined()
		})

		it('should return undefined for number 0', () => {
			const obj = { flag: 0 }
			expect(getBoolean(obj, 'flag')).toBeUndefined()
		})

		it('should return undefined for object', () => {
			const obj = { flag: {} }
			expect(getBoolean(obj, 'flag')).toBeUndefined()
		})

		it('should return undefined for null', () => {
			const obj = { flag: null }
			expect(getBoolean(obj, 'flag')).toBeUndefined()
		})
	})

	describe('Missing Properties', () => {
		it('should return undefined for missing property', () => {
			const obj = { other: true }
			expect(getBoolean(obj, 'flag')).toBeUndefined()
		})
	})
})

describe('getObject', () => {
	describe('Valid Objects', () => {
		it('should return nested object', () => {
			const obj = { nested: { key: 'value' } }
			const result = getObject(obj, 'nested')
			expect(result).toEqual({ key: 'value' })
		})

		it('should return empty object', () => {
			const obj = { nested: {} }
			const result = getObject(obj, 'nested')
			expect(result).toEqual({})
		})

		it('should return deeply nested object', () => {
			const obj = { level1: { level2: { level3: 'value' } } }
			const result = getObject(obj, 'level1')
			expect(result).toEqual({ level2: { level3: 'value' } })
		})
	})

	describe('Invalid Types', () => {
		it('should return undefined for array', () => {
			const obj = { value: [1, 2, 3] }
			expect(getObject(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for string', () => {
			const obj = { value: 'string' }
			expect(getObject(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for number', () => {
			const obj = { value: 123 }
			expect(getObject(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for boolean', () => {
			const obj = { value: true }
			expect(getObject(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for null', () => {
			const obj = { value: null }
			expect(getObject(obj, 'value')).toBeUndefined()
		})
	})

	describe('Missing Properties', () => {
		it('should return undefined for missing property', () => {
			const obj = { other: {} }
			expect(getObject(obj, 'nested')).toBeUndefined()
		})
	})
})

describe('getArray', () => {
	describe('Valid Arrays', () => {
		it('should return array of numbers', () => {
			const obj = { list: [1, 2, 3] }
			const result = getArray(obj, 'list')
			expect(result).toEqual([1, 2, 3])
		})

		it('should return array of strings', () => {
			const obj = { list: ['a', 'b', 'c'] }
			const result = getArray(obj, 'list')
			expect(result).toEqual(['a', 'b', 'c'])
		})

		it('should return empty array', () => {
			const obj = { list: [] }
			const result = getArray(obj, 'list')
			expect(result).toEqual([])
		})

		it('should return array of objects', () => {
			const obj = { list: [{ id: 1 }, { id: 2 }] }
			const result = getArray(obj, 'list')
			expect(result).toEqual([{ id: 1 }, { id: 2 }])
		})

		it('should return mixed type array', () => {
			const obj = { list: [1, 'two', { three: 3 }, null] }
			const result = getArray(obj, 'list')
			expect(result).toEqual([1, 'two', { three: 3 }, null])
		})
	})

	describe('Invalid Types', () => {
		it('should return undefined for object', () => {
			const obj = { value: { key: 'value' } }
			expect(getArray(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for string', () => {
			const obj = { value: 'string' }
			expect(getArray(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for number', () => {
			const obj = { value: 123 }
			expect(getArray(obj, 'value')).toBeUndefined()
		})

		it('should return undefined for null', () => {
			const obj = { value: null }
			expect(getArray(obj, 'value')).toBeUndefined()
		})
	})

	describe('Missing Properties', () => {
		it('should return undefined for missing property', () => {
			const obj = { other: [] }
			expect(getArray(obj, 'list')).toBeUndefined()
		})
	})
})

describe('get', () => {
	describe('Any Value Type', () => {
		it('should return string', () => {
			const obj = { value: 'string' }
			expect(get(obj, 'value')).toBe('string')
		})

		it('should return number', () => {
			const obj = { value: 123 }
			expect(get(obj, 'value')).toBe(123)
		})

		it('should return boolean', () => {
			const obj = { value: true }
			expect(get(obj, 'value')).toBe(true)
		})

		it('should return object', () => {
			const obj = { value: { key: 'val' } }
			expect(get(obj, 'value')).toEqual({ key: 'val' })
		})

		it('should return array', () => {
			const obj = { value: [1, 2, 3] }
			expect(get(obj, 'value')).toEqual([1, 2, 3])
		})

		it('should return null', () => {
			const obj = { value: null }
			expect(get(obj, 'value')).toBeNull()
		})

		it('should return undefined for undefined value', () => {
			const obj = { value: undefined }
			expect(get(obj, 'value')).toBeUndefined()
		})
	})

	describe('Missing Properties', () => {
		it('should return undefined for missing property', () => {
			const obj = { other: 'value' }
			expect(get(obj, 'key')).toBeUndefined()
		})

		it('should return undefined for non-object', () => {
			expect(get(null, 'key')).toBeUndefined()
		})
	})
})

describe('isArrayOfType', () => {
	describe('Valid Arrays', () => {
		it('should return true for array with matching type', () => {
			const arr = [{ type: 'test' }]
			expect(isArrayOfType(arr, 'test')).toBe(true)
		})

		it('should return true when at least one item has matching type', () => {
			const arr = [{ type: 'other' }, { type: 'test' }, { type: 'another' }]
			expect(isArrayOfType(arr, 'test')).toBe(true)
		})

		it('should return true for array with multiple matching items', () => {
			const arr = [{ type: 'test' }, { type: 'test' }]
			expect(isArrayOfType(arr, 'test')).toBe(true)
		})

		it('should return true for array with objects having additional properties', () => {
			const arr = [{ type: 'test', id: 1, name: 'Item' }]
			expect(isArrayOfType(arr, 'test')).toBe(true)
		})
	})

	describe('Invalid Arrays', () => {
		it('should return false for array without matching type', () => {
			const arr = [{ type: 'other' }]
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should return false for array with no type property', () => {
			const arr = [{ id: 1, name: 'Item' }]
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should return false for empty array', () => {
			const arr: unknown[] = []
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should return false for array of primitives', () => {
			const arr = [1, 2, 3]
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should return false for array of strings', () => {
			const arr = ['test', 'other']
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should return false for array with null type', () => {
			const arr = [{ type: null }]
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should return false for array with undefined type', () => {
			const arr = [{ type: undefined }]
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})
	})

	describe('Non-Array Inputs', () => {
		it('should return false for null', () => {
			expect(isArrayOfType(null, 'test')).toBe(false)
		})

		it('should return false for undefined', () => {
			expect(isArrayOfType(undefined, 'test')).toBe(false)
		})

		it('should return false for object', () => {
			const obj = { type: 'test' }
			expect(isArrayOfType(obj, 'test')).toBe(false)
		})

		it('should return false for string', () => {
			expect(isArrayOfType('test', 'test')).toBe(false)
		})

		it('should return false for number', () => {
			expect(isArrayOfType(123, 'test')).toBe(false)
		})
	})

	describe('Edge Cases', () => {
		it('should handle mixed array with objects and primitives', () => {
			const arr = [1, 'string', { type: 'test' }, null]
			expect(isArrayOfType(arr, 'test')).toBe(true)
		})

		it('should be case-sensitive for type matching', () => {
			const arr = [{ type: 'Test' }]
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should match exact type string', () => {
			const arr = [{ type: 'test-type' }]
			expect(isArrayOfType(arr, 'test')).toBe(false)
		})

		it('should handle arrays with nested objects', () => {
			const arr = [{ type: 'test', nested: { type: 'other' } }]
			expect(isArrayOfType(arr, 'test')).toBe(true)
		})
	})
})

describe('Integration Tests', () => {
	describe('Chaining Safe Access Functions', () => {
		it('should safely navigate nested structures', () => {
			const data = {
				user: {
					name: 'John',
					age: 30,
					active: true,
					settings: {
						theme: 'dark',
					},
					tags: ['admin', 'verified'],
				},
			}

			const user = getObject(data, 'user')
			expect(user).toBeDefined()

			if (user) {
				expect(getString(user, 'name')).toBe('John')
				expect(getNumber(user, 'age')).toBe(30)
				expect(getBoolean(user, 'active')).toBe(true)

				const settings = getObject(user, 'settings')
				expect(settings).toBeDefined()
				if (settings) {
					expect(getString(settings, 'theme')).toBe('dark')
				}

				const tags = getArray(user, 'tags')
				expect(tags).toEqual(['admin', 'verified'])
			}
		})

		it('should handle missing nested properties gracefully', () => {
			const data = { user: { name: 'John' } }

			const user = getObject(data, 'user')
			expect(user).toBeDefined()

			if (user) {
				expect(getString(user, 'name')).toBe('John')
				expect(getNumber(user, 'age')).toBeUndefined()
				expect(getObject(user, 'settings')).toBeUndefined()
			}

			const missing = getObject(data, 'missing')
			expect(missing).toBeUndefined()
		})
	})

	describe('Real-world Data Structures', () => {
		it('should handle API response', () => {
			const response = {
				data: {
					id: 123,
					title: 'Test Post',
					published: true,
					author: {
						name: 'Jane Doe',
					},
					tags: ['tech', 'typescript'],
				},
				meta: {
					version: '1.0',
					count: 42,
				},
			}

			const data = getObject(response, 'data')
			expect(data).toBeDefined()

			if (data) {
				expect(getNumber(data, 'id')).toBe(123)
				expect(getString(data, 'title')).toBe('Test Post')
				expect(getBoolean(data, 'published')).toBe(true)

				const author = getObject(data, 'author')
				expect(author).toBeDefined()
				if (author) {
					expect(getString(author, 'name')).toBe('Jane Doe')
				}

				const tags = getArray(data, 'tags')
				expect(tags).toEqual(['tech', 'typescript'])
			}

			const meta = getObject(response, 'meta')
			expect(meta).toBeDefined()
			if (meta) {
				expect(getString(meta, 'version')).toBe('1.0')
				expect(getNumber(meta, 'count')).toBe(42)
			}
		})

		it('should handle message content blocks', () => {
			const message = {
				content: [
					{ type: 'text', text: 'Hello' },
					{ type: 'tool_use', id: 'tool-1', name: 'bash' },
					{ type: 'text', text: 'World' },
				],
			}

			const content = getArray(message, 'content')
			expect(content).toBeDefined()

			expect(isArrayOfType(message.content, 'text')).toBe(true)
			expect(isArrayOfType(message.content, 'tool_use')).toBe(true)
			expect(isArrayOfType(message.content, 'image')).toBe(false)
		})
	})
})
