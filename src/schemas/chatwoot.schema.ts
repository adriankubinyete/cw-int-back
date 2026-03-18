import { z } from "zod";

export interface ChatwootSender {
    id: number;
    name: string;
    avatar?: string;
    type: "contact" | "agent" | "bot";
    phone_number: string | null;
    custom_attributes: Record<string, any>;
    account: { id: number; name: string };
    labels: any[];
}

export interface ChatwootAttachment {
    id: number;
    message_id: number;
    file_type: "image" | "audio" | "video" | "file" | "location";
    account_id: number;
    content_type: string;
    data_url: string;
    thumb_url?: string;
    filename: string;
    file_size: number;
}

export interface ChatwootMessage {
    id: number;
    content: string | null; // null quando é só mídia
    message_type: "incoming" | "outgoing" | "activity";
    created_at: string;
    private: boolean;
    source_id: string;
    content_type: "text" | "input_select" | "cards" | "form";
    content_attributes: Record<string, any>;
    sender: ChatwootSender;
    account: { id: number; name: string };
    conversation: {
        id: number;
        inbox_id: number;
        account_id: number;
        status: "open" | "resolved" | "pending";
        labels: { id: number; title: string; description: string }[];
        [key: string]: any;
    };
    inbox: { id: number; name: string };
    attachments?: ChatwootAttachment[];
}

export interface ChatwootWebhookPayload {
    event: string; // "automation_event.message_created" | "message_created" | etc
    id: number;                  // conversation id
    inbox_id: number;
    account_id: number;
    status: "open" | "resolved" | "pending";
    channel: string;
    can_reply: boolean;
    messages: ChatwootMessage[]; // o Chatwoot manda array mas geralmente é 1
    meta: {
        sender: ChatwootSender;
        assignee: ChatwootSender | null;
    };
    contact_inbox: {
        id: number;
        contact_id: number;
        inbox_id: number;
        source_id: string;
    };
    labels: { id: number; title: string; description: string }[];
    [key: string]: any;
}

// helpers pra extrair os campos mais usados pelo executor
export function extractContact(payload: ChatwootWebhookPayload) {
    const sender = payload.messages[0]?.sender ?? payload.meta.sender;
    return {
        id: String(sender.id),
        name: sender.name,
        phone: sender.phone_number ?? undefined,
        avatar: sender.avatar,
    };
}

export function extractMessage(payload: ChatwootWebhookPayload) {
    const msg = payload.messages[0];
    return {
        id: String(msg?.id),
        content: msg?.content ?? null,
        type: msg?.message_type,
        hasAttachment: (msg?.attachments?.length ?? 0) > 0,
        attachments: msg?.attachments ?? [],
    };
}

export function extractConversation(payload: ChatwootWebhookPayload) {
    return {
        id: payload.id,
        inboxId: payload.inbox_id,
        accountId: payload.account_id,
        status: payload.status,
    };
}

export const webhookParamsSchema = z.object({
    workflowId: z.string(),
});