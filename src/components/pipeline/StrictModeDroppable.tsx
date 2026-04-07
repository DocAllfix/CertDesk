/**
 * StrictModeDroppable — Fix per @hello-pangea/dnd + React.StrictMode.
 *
 * Il doppio mount di StrictMode causa un loop infinito di setState nel
 * setRef di Droppable. Questo wrapper ritarda il render di 1 frame
 * per evitare il conflitto.
 *
 * Ref: https://github.com/hello-pangea/dnd/issues/316
 */
import { useState, useEffect } from 'react'
import { Droppable, type DroppableProps } from '@hello-pangea/dnd'

export function StrictModeDroppable(props: DroppableProps) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true))
    return () => {
      cancelAnimationFrame(animation)
      setEnabled(false)
    }
  }, [])

  if (!enabled) return null

  return <Droppable {...props} />
}
