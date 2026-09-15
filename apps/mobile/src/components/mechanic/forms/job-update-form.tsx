import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ClipboardList, Plus, X } from 'lucide-react-native';
import { ActionButton } from '@/components/ui/action-button';
import { Field, FormTextInput } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { MechanicJob, MechanicJobStatus, JobUpdatePayload } from '@/lib/mechanic-types';

const statusOptions: { id: MechanicJobStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'awaiting_parts', label: 'Awaiting parts' },
  { id: 'completed', label: 'Completed' },
];

export function JobUpdateForm({
  job,
  onSave,
  onComplete,
}: {
  job: MechanicJob;
  onSave: (status: MechanicJobStatus, notes: string) => void;
  onComplete: (payload: JobUpdatePayload) => void;
}) {
  const [status, setStatus] = useState<MechanicJobStatus>(job.status);
  const [notes, setNotes] = useState(job.notes ?? '');
  const [price, setPrice] = useState(job.price.toString());
  const [parts, setParts] = useState<string[]>(job.partsReplaced ?? []);
  const [newPart, setNewPart] = useState('');

  const addPart = () => {
    const trimmed = newPart.trim();
    if (!trimmed) return;
    setParts((prev) => [...prev, trimmed]);
    setNewPart('');
  };

  const removePart = (idx: number) => setParts((prev) => prev.filter((_, i) => i !== idx));

  const canSave =
    status === 'completed'
      ? Number(price) > 0
      : status !== job.status || notes !== (job.notes ?? '');

  const handleSubmit = () => {
    if (status === 'completed') {
      onComplete({
        price: Number(price) || 0,
        notes: notes.trim() || undefined,
        partsReplaced: parts.length > 0 ? parts : undefined,
      });
    } else {
      onSave(status, notes.trim());
    }
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View className="gap-4">
        <View>
          <Text className="mb-2 text-sm font-semibold text-foreground">Update status</Text>
          <View className="flex-row flex-wrap gap-2">
            {statusOptions.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setStatus(opt.id)}
                className={cn(
                  'min-w-[48%] flex-1 rounded-2xl border px-3 py-2.5 active:scale-[0.98]',
                  status === opt.id ? 'border-primary bg-primary' : 'border-border bg-background',
                )}
              >
                <Text
                  className={cn(
                    'text-center text-sm font-medium',
                    status === opt.id ? 'text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Field label="Repair notes">
          <FormTextInput
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe what you did, parts you noticed, advice for customer..."
            className="min-h-[100px]"
          />
        </Field>

        {status === 'completed' && (
          <>
            <Field label="Final price (VND)">
              <FormTextInput
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                placeholder="180000"
              />
            </Field>

            <View>
              <Text className="mb-1.5 block text-sm font-semibold text-foreground">Parts replaced</Text>
              <View className="flex-row gap-2">
                <FormTextInput
                  value={newPart}
                  onChangeText={setNewPart}
                  onSubmitEditing={addPart}
                  placeholder="e.g. Brake pads"
                  className="flex-1"
                  returnKeyType="done"
                />
                <Pressable
                  onPress={addPart}
                  accessibilityLabel="Add part"
                  className="size-12 shrink-0 items-center justify-center rounded-2xl bg-primary active:opacity-60"
                >
                  <Plus size={20} color="#ffffff" />
                </Pressable>
              </View>
              {parts.length > 0 && (
                <View className="mt-3 gap-2">
                  {parts.map((p, i) => (
                    <View key={i} className="flex-row items-center gap-2 rounded-2xl bg-secondary px-3 py-2">
                      <ClipboardList size={16} color="#64748b" />
                      <Text className="flex-1 truncate text-sm text-foreground">{p}</Text>
                      <Pressable
                        onPress={() => removePart(i)}
                        accessibilityLabel={`Remove ${p}`}
                        className="size-7 items-center justify-center rounded-full active:bg-background"
                      >
                        <X size={16} color="#64748b" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <ActionButton
          fullWidth
          disabled={!canSave}
          variant={status === 'completed' ? 'mint' : 'primary'}
          onPress={handleSubmit}
        >
          <Text
            className={`text-sm font-semibold ${status === 'completed' ? 'text-green' : 'text-primary-foreground'}`}
          >
            {status === 'completed' ? 'Mark as completed' : 'Save changes'}
          </Text>
        </ActionButton>
      </View>
    </ScrollView>
  );
}
