import { useState, useEffect, useRef } from 'react'

interface Options {
  intervalMs?: number
}


export function useFakeStream(fullText: string | null, options: Options = {}) {
  const { intervalMs = 18 } = options
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)
  const tickRef = useRef(0)

  useEffect(() => {
    if (!fullText) {
      setDisplayed('')
      setDone(false)
      indexRef.current = 0
      tickRef.current = 0
      return
    }

    setDisplayed('')
    setDone(false)
    indexRef.current = 0
    tickRef.current = 0

    const schedule = (delay: number) => {
      const id = setTimeout(() => {
        const i = indexRef.current
        if (i >= fullText.length) {
          setDisplayed(fullText)
          setDone(true)
          return
        }

        // Ramp up: first 3 ticks dump 12 chars, then settle at 3 chars/tick
        const tick = tickRef.current
        const chunkSize = tick < 3 ? 12 : 3
        tickRef.current += 1

        const nextIndex = Math.min(i + chunkSize, fullText.length)
        indexRef.current = nextIndex
        setDisplayed(fullText.slice(0, nextIndex))

        if (nextIndex >= fullText.length) {
          setDone(true)
          return
        }

        // Pause at sentence boundaries for a natural breath
        const lastChar = fullText[nextIndex - 1]
        const isPause = lastChar === '.' || lastChar === '!' || lastChar === '?' || lastChar === '\n'
        schedule(isPause ? intervalMs * 5 : intervalMs)
      }, delay)

      return id
    }

    // Tiny initial delay so the thinking indicator has a moment to clear
    schedule(intervalMs)
  }, [fullText])

  return { displayed, done }
}
