// src/lib/chatwoot.ts
import axios, { type AxiosInstance } from "axios";
import { logger, toError } from "./logger";

const chatwootLogger = logger.child({ context: "ChatwootClient" });

export interface ChatwootAuthConfig {
    baseUrl: string;
    apiToken: string;
}

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
            chatwootLogger.debug("chatwoot request", {
                method: config.method?.toUpperCase(),
                url: config.url,
                data: config.data,
            });
            return config;
        });

        this.client.interceptors.response.use(
            (response) => {
                chatwootLogger.debug("chatwoot response", {
                    method: response.config.method?.toUpperCase(),
                    url: response.config.url,
                    status: response.status,
                });
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

    async sendMessage(accountId: number, conversationId: number, content: string): Promise<void> {
        await this.client.post(
            `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
            { content, message_type: "outgoing", private: false }
        );

        chatwootLogger.info("message sent", { accountId, conversationId });
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