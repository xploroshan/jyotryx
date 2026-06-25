-- Add PENDING to SubscriptionStatus so a live (Razorpay-hosted) subscription
-- row can exist before the first charge without entitling the user to Premium
-- or to subscriber-free paid features. The subscription.activated/charged
-- webhook flips PENDING -> ACTIVE once a payment is actually captured.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
