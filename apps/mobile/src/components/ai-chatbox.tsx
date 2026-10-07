import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Bot, ImagePlus, Send, Sparkles } from 'lucide-react-native';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { aiSuggestions, diagnose } from '@/lib/mock-ai';
import type { ChatMessage } from '@/lib/types';

export function AiChatbox() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'ai',
      text: 'Xin chào! Mình là CareBot. Mô tả sự cố của xe máy — hoặc đính kèm ảnh — để mình gợi ý nguyên nhân và ước tính chi phí giúp bạn.',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', text: trimmed };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: 'ai', text: diagnose(trimmed) }]);
    }, 1100);
  };

  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center gap-2 border-b border-border bg-secondary/50 px-4 py-3">
        <View className="size-9 items-center justify-center rounded-full bg-primary/10">
          <Bot size={20} color="#1974f7" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold leading-tight text-foreground">Trợ lý CareBot</Text>
          <View className="flex-row items-center gap-1">
            <View className="size-1.5 rounded-full bg-green" />
            <Text className="text-xs text-green">Đang hoạt động</Text>
          </View>
        </View>
        <Sparkles size={16} color="#1974f7" />
      </View>

      <ScrollView ref={scrollRef} className="max-h-72 p-4">
        {messages.map((m) => (
          <View
            key={m.id}
            className={cn('mb-3 flex-row', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <View
              className={cn(
                'max-w-[80%] rounded-2xl px-3.5 py-2.5',
                m.role === 'user'
                  ? 'rounded-br-md bg-primary'
                  : 'rounded-bl-md bg-secondary',
              )}
            >
              <Text
                className={cn(
                  'text-sm',
                  m.role === 'user' ? 'text-primary-foreground' : 'text-secondary-foreground',
                )}
              >
                {m.text}
              </Text>
            </View>
          </View>
        ))}
        {typing && (
          <View className="mb-3 flex-row justify-start">
            <View className="flex-row gap-1 rounded-2xl rounded-bl-md bg-secondary px-4 py-3">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="size-1.5 rounded-full bg-muted-foreground"
                  style={{ opacity: 0.6 }}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View className="flex-row flex-wrap gap-2 px-4 pb-2">
        {aiSuggestions.map((s) => (
          <Pressable
            key={s}
            onPress={() => send(s)}
            className="rounded-full border border-border px-3 py-1.5 active:scale-95"
          >
            <Text className="text-xs font-medium text-muted-foreground">{s}</Text>
          </Pressable>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View className="flex-row items-center gap-2 border-t border-border p-3">
          <Pressable
            accessibilityLabel="Đính kèm ảnh"
            onPress={() => send('Đây là ảnh sự cố [đã đính kèm ảnh]')}
            className="size-10 shrink-0 items-center justify-center rounded-full bg-secondary active:scale-90"
          >
            <ImagePlus size={20} color="#64748b" />
          </Pressable>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Mô tả sự cố..."
            placeholderTextColor="#94a3b8"
            className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2.5 text-sm text-foreground"
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <Pressable
            accessibilityLabel="Gửi tin nhắn"
            onPress={() => send(input)}
            className="size-10 shrink-0 items-center justify-center rounded-full bg-primary active:scale-90"
          >
            <Send size={16} color="#ffffff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Card>
  );
}
