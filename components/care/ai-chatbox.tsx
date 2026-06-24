"use client"

import { useEffect, useRef, useState } from "react"
import { Bot, Send, ImagePlus, Sparkles } from "lucide-react"
import { Card } from "./ui"
import { cn } from "@/lib/utils"
import { diagnose, aiSuggestions } from "@/lib/mock-ai"
import type { ChatMessage } from "@/lib/types"

export function AiChatbox() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "ai",
      text: "Hi! I'm CareBot. Describe what's wrong with your motorcycle — or attach a photo — and I'll suggest the likely cause and an estimated price.",
    },
  ])
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages, typing])

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const userMsg: ChatMessage = {
      id: `u${Date.now()}`,
      role: "user",
      text: trimmed,
    }
    setMessages((m) => [...m, userMsg])
    setInput("")
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages((m) => [
        ...m,
        { id: `a${Date.now()}`, role: "ai", text: diagnose(trimmed) },
      ])
    }, 1100)
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold leading-tight">CareBot Assistant</p>
          <p className="flex items-center gap-1 text-xs text-[var(--green)] dark:text-[var(--mint)]">
            <span className="size-1.5 rounded-full bg-current" /> Online
          </p>
        </div>
        <Sparkles className="size-4 text-primary" />
      </div>

      <div ref={scrollRef} className="max-h-72 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm",
                m.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-secondary text-secondary-foreground",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-secondary px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {aiSuggestions.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors active:scale-95 hover:bg-secondary"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <button
          type="button"
          aria-label="Attach photo"
          onClick={() =>
            send("Here is a photo of the issue [image attached]")
          }
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-transform active:scale-90"
        >
          <ImagePlus className="size-5" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the problem..."
          className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90"
        >
          <Send className="size-4" />
        </button>
      </form>
    </Card>
  )
}
