import { useState, useEffect, useRef } from 'react'

interface Options {
  charsPerTick?: number
  intervalMs?: number
}

export function useFakeStream(fullText: string | null, options: Options = {}) {
  const { charsPerTick = 8, intervalMs = 16 } = options
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)

  useEffect(() => {
    if (!fullText) {
      setDisplayed('')
      setDone(false)
      indexRef.current = 0
      return
    }
    setDisplayed('')
    setDone(false)
    indexRef.current = 0

    const id = setInterval(() => {
      indexRef.current += charsPerTick
      if (indexRef.current >= fullText.length) {
        setDisplayed(fullText)
        setDone(true)
        clearInterval(id)
      } else {
        setDisplayed(fullText.slice(0, indexRef.current))
      }
    }, intervalMs)

    return () => clearInterval(id)
  }, [fullText])

  return { displayed, done }
}