import { SubscribeLogEvents, type LogEvent } from "@tixrouter/db";

type EventClient = (event: LogEvent) => void;

const clients = new Set<EventClient>();
let detachSink: (() => void) | null = null;

function attachSink(): void {
    if (detachSink) return;
    detachSink = SubscribeLogEvents((event) => {
        for (const client of clients) {
            try {
                client(event);
            } catch {
                clients.delete(client);
            }
        }
    });
}

function maybeDetachSink(): void {
    if (clients.size === 0 && detachSink) {
        detachSink();
        detachSink = null;
    }
}

export function AddEventClient(client: EventClient): () => void {
    attachSink();
    clients.add(client);
    return () => {
        clients.delete(client);
        maybeDetachSink();
    };
}
