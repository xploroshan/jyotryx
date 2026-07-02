import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import type { FieldSpec, RequestCtx, Values } from './types';

/**
 * Renders a feature's input fields from its FieldSpec[]. Keeps everything as
 * string values (the request builders parse/shape them). Date/time use plain
 * text inputs with format hints — a native picker is a later polish; this keeps
 * the framework dependency-light and testable now.
 */
export function useFeatureValues(fields: FieldSpec[], ctx: RequestCtx): [Values, (k: string, v: string) => void] {
  const initial = useMemo(() => {
    const v: Values = {};
    for (const f of fields) {
      if (f.prefillFromProfile && ctx.user?.[f.prefillFromProfile]) {
        v[f.key] = String(ctx.user[f.prefillFromProfile]);
      } else if (f.default != null) {
        v[f.key] = f.default;
      } else {
        v[f.key] = '';
      }
    }
    return v;
    // Only re-init when the field set or profile identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);
  const [values, setValues] = useState<Values>(initial);
  const set = (k: string, val: string) => setValues((cur) => ({ ...cur, [k]: val }));
  return [values, set];
}

function Label({ text, help }: { text: string; help?: string }) {
  return (
    <View className="flex-row justify-between mb-1">
      <Text className="text-fg-muted text-xs">{text}</Text>
      {help ? <Text className="text-fg-subtle text-[11px]">{help}</Text> : null}
    </View>
  );
}

const inputCls = 'h-11 rounded-lg border border-border bg-bg px-3 text-fg';

function SelectField({ field, value, onChange }: { field: FieldSpec; value: string; onChange: (v: string) => void }) {
  return (
    <View>
      <Label text={field.label} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {field.options?.map((o) => {
            const on = value === o.value;
            return (
              <Pressable
                key={o.value}
                testID={`field-${field.key}-${o.value}`}
                onPress={() => onChange(o.value)}
                className={`px-3 py-2 rounded-full border ${on ? 'bg-accent-subtle border-accent' : 'bg-surface border-border'}`}
              >
                <Text className={`text-sm ${on ? 'text-accent' : 'text-fg-muted'}`}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export function FieldForm({
  fields,
  values,
  onChange,
}: {
  fields: FieldSpec[];
  values: Values;
  onChange: (k: string, v: string) => void;
}) {
  return (
    <View className="gap-3">
      {fields
        .filter((f) => !f.showIf || f.showIf(values))
        .map((f) => {
          if (f.type === 'select') {
            return <SelectField key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => onChange(f.key, v)} />;
          }
          const keyboard =
            f.type === 'number' ? 'numbers-and-punctuation' : f.type === 'time' ? 'numbers-and-punctuation' : 'default';
          const placeholder =
            f.placeholder ??
            (f.type === 'date' ? 'YYYY-MM-DD' : f.type === 'time' ? 'HH:MM' : f.type === 'place' ? 'City, Country' : '');
          return (
            <View key={f.key}>
              <Label text={f.label + (f.optional ? ' (optional)' : '')} help={f.help} />
              <TextInput
                testID={`field-${f.key}`}
                value={values[f.key] ?? ''}
                onChangeText={(v) => onChange(f.key, v)}
                placeholder={placeholder}
                placeholderTextColor="#807666"
                autoCapitalize={f.type === 'place' || f.type === 'text' ? 'words' : 'none'}
                keyboardType={keyboard as never}
                className={inputCls}
              />
            </View>
          );
        })}
    </View>
  );
}

/** Which required fields are still blank (for disabling submit). */
export function missingRequired(fields: FieldSpec[], values: Values): string[] {
  return fields
    .filter((f) => f.required && (!f.showIf || f.showIf(values)))
    .filter((f) => !(values[f.key] ?? '').trim())
    .map((f) => f.key);
}
