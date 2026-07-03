import { Stack } from 'expo-router';
import { PricingScreen } from '@/payments/PricingScreen';

export default function Pricing() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '✨ Pricing' }} />
      <PricingScreen />
    </>
  );
}
