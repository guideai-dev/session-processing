/**
 * ScrollToTopButton - Floating button that appears when user scrolls down
 *
 * Features:
 * - Only appears after scrolling down 300px
 * - Positioned at bottom-right with fixed positioning
 * - Smooth scroll animation to top
 * - Fade in/out transition
 */

import { useEffect, useState } from 'react'

export interface ScrollToTopButtonProps {
  /** Optional custom scroll threshold in pixels (default: 300) */
  threshold?: number

  /** Optional custom scroll container selector (default: 'main') */
  scrollContainer?: string
}

export function ScrollToTopButton({
  threshold = 300,
  scrollContainer = 'main',
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const container = document.querySelector(scrollContainer)

    const handleScroll = () => {
      let scrollTop = 0

      // Try container scroll first
      if (container && container.scrollTop > 0) {
        scrollTop = container.scrollTop
      } else {
        // Fallback to window scroll
        scrollTop = window.pageYOffset || document.documentElement.scrollTop
      }

      setIsVisible(scrollTop > threshold)
    }

    // Check initial scroll position
    handleScroll()

    // Add scroll listeners to both container (if exists) and window
    if (container) {
      container.addEventListener('scroll', handleScroll)
    }
    window.addEventListener('scroll', handleScroll)

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll)
      }
      window.removeEventListener('scroll', handleScroll)
    }
  }, [scrollContainer, threshold])

  const scrollToTop = () => {
    const container = document.querySelector(scrollContainer)
    if (container) {
      container.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
    // Fallback to window scroll
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  if (!isVisible) return null

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-50 btn btn-circle btn-primary shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-in"
      title="Scroll to top"
      aria-label="Scroll to top"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  )
}
