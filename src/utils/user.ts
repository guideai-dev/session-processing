/**
 * User utility functions
 */

export interface UserInfo {
  name?: string | null
  username?: string | null
  email?: string | null
}

/**
 * Extract a friendly display name from user information
 * Tries to extract first name from full name, falls back to @username
 *
 * @param user - User information with optional name, username, email
 * @returns Display name suitable for AI prompts (e.g., "John" or "@johndoe")
 *
 * @example
 * getUserDisplayName({ name: "John Doe", username: "johndoe" }) // Returns "John"
 * getUserDisplayName({ username: "johndoe" }) // Returns "@johndoe"
 * getUserDisplayName({ email: "john@example.com" }) // Returns "@john"
 */
export function getUserDisplayName(user: UserInfo): string {
  // Try to extract first name from full name
  if (user.name) {
    const firstName = user.name.trim().split(/\s+/)[0]
    if (firstName && firstName.length > 0) {
      return firstName
    }
  }

  // Fall back to @username
  if (user.username) {
    return `@${user.username}`
  }

  // Last resort: extract from email
  if (user.email) {
    const emailUsername = user.email.split('@')[0]
    return `@${emailUsername}`
  }

  // Ultimate fallback
  return 'the user'
}
