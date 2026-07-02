/**
 * Small NativeWind UI primitives shared across screens. Class strings use the
 * Warm Linen tokens from tailwind.config.js so the app matches web visually.
 */
import { forwardRef } from 'react';
import {
  Text,
  View,
  Pressable,
  ActivityIndicator,
  type PressableProps,
  type ViewProps,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ className, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className={`flex-1 px-5 ${className ?? ''}`} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

export function Card({ className, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-2xl bg-surface border border-border p-4 ${className ?? ''}`}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Heading({ className, children, ...rest }: TextProps & { className?: string }) {
  return (
    <Text className={`text-fg text-2xl font-bold ${className ?? ''}`} {...rest}>
      {children}
    </Text>
  );
}

export function Muted({ className, children, ...rest }: TextProps & { className?: string }) {
  return (
    <Text className={`text-fg-muted text-sm ${className ?? ''}`} {...rest}>
      {children}
    </Text>
  );
}

interface ButtonProps extends PressableProps {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

export const Button = forwardRef<View, ButtonProps>(function Button(
  { title, loading, variant = 'primary', disabled, ...rest },
  ref,
) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled || loading}
      className={`h-12 rounded-lg items-center justify-center ${
        isPrimary ? 'bg-accent' : 'bg-surface border border-border-strong'
      } ${disabled || loading ? 'opacity-50' : ''}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#fff' : '#c43200'} />
      ) : (
        <Text className={`font-semibold ${isPrimary ? 'text-fg-onaccent' : 'text-accent'}`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
});
