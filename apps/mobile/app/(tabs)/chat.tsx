import { Screen, Heading, Muted, Card } from '@/components/ui';

/**
 * Chat with Astrologer — streaming (POST /chat/stream), server-side sessions
 * (GET /chat/sessions) and memory (GET/POST /memory). Full implementation is
 * the P4 milestone; this placeholder reserves the tab and endpoint contract.
 */
export default function Chat() {
  return (
    <Screen>
      <Heading className="mt-4 mb-3">Chat</Heading>
      <Card>
        <Muted>
          Streaming chat with your astrologer lands in P4 (POST /chat/stream + session list + memory).
        </Muted>
      </Card>
    </Screen>
  );
}
