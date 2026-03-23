// src/lib/chatwoot.ts
import axios, { type AxiosInstance } from "axios";
import { logger, toError } from "./logger";
import type { ChatwootAuthConfig } from "../schemas/integrations.schema";
import { config } from "dotenv";


const chatwootLogger = logger.child({ context: "ChatwootClient" });

export class ChatwootClient {
    private client: AxiosInstance;

    constructor(auth: ChatwootAuthConfig) {
        this.client = axios.create({
            baseURL: auth.baseUrl.replace(/\/$/, ""),
            headers: {
                api_access_token: auth.apiToken,
                "Content-Type": "application/json",
            },
        });

        this.client.interceptors.request.use((config) => {
            chatwootLogger.http(`-> ${config.method?.toUpperCase()} ${config.url} data.length=${JSON.stringify(config.data).length}`);
            return config;
        });

        this.client.interceptors.response.use(
            (response) => {
                chatwootLogger.http(`<- ${response.config.method?.toUpperCase()} ${response.config.url} status=${response.status}`);
                return response;
            },
            (error) => {
                chatwootLogger.error("chatwoot response error", {
                    method: error.config?.method?.toUpperCase(),
                    url: error.config?.url,
                    status: error.response?.status,
                    data: error.response?.data,
                    err: toError(error),
                });
                return Promise.reject(error);
            }
        );
    }

    async sendMessage(accountId: number, conversationId: number, content: string, isPrivate: boolean = false): Promise<void> {
        console.log("Content: ", content);
        const safeContent = content
            // quebra QUALQUER abertura de template
            .replace(/{{+/g, "{")
            // quebra QUALQUER fechamento de template
            .replace(/}}+/g, "}");
        if (content !== safeContent) {
            chatwootLogger.error(`[${accountId}/${conversationId}] Content contained escaped template injection attempt`, {
                original: content,
                sanitized: safeContent
            });
        }
        console.log("Safe Content: ", safeContent);
        await this.client.post(
            `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
            { content: safeContent, message_type: "outgoing", private: isPrivate }
        );

        chatwootLogger.info(`[${accountId}/${conversationId}] Sending message: '${safeContent}'`, { private: isPrivate });
    }

    async testConnection(accountId: number): Promise<boolean> {
        try {
            await this.client.get(`/api/v1/accounts/${accountId}/conversations`);
            return true;
        } catch {
            return false;
        }
    }
}