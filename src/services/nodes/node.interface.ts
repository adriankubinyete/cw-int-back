import type { ChatwootClient } from "../../lib/chatwoot";

export interface NodeDefinition {
    type: string;
    label: string;
    description: string;
    category: "messaging" | "erp" | "logic";
    icon: string;
    configSchema: FieldSchema[];
    outputs: NodeOutput[];
}

export interface FieldSchema {
    key: string;
    label: string;
    type: "text" | "textarea" | "select" | "integration";
    required: boolean;
    placeholder?: string;
    options?: { label: string; value: string }[];
}

export interface NodeOutput {
    key: string;
    label: string;
}

export interface NodeHandler {
    definition: NodeDefinition;
    execute(context: NodeExecutionContext): Promise<NodeExecutionResult>;
}

export interface NodeExecutionContext {
    node: {
        id: string;
        type: string;
        data: Record<string, any>;
    };
    execution: ExecutionContext;
    userId: string;
    chatwoot: ChatwootClient;
}

export interface NodeExecutionResult {
    output: string; // qual handle foi ativado: "default" | "true" | "false" | "found" | ...
    contextPatch?: Partial<ExecutionContext>; // o que o nó quer escrever no contexto
}

export interface ExecutionContext {
    contact: { id?: string; phone?: string; name?: string; avatar?: string; [key: string]: any };
    message: { id?: string; content: string | null; type?: string; hasAttachment?: boolean; attachments?: any[]; [key: string]: any };
    conversation: { id: number; inboxId: number; accountId: number; status: string; [key: string]: any };
    client: Record<string, any> | null;
    contracts: any[];
    variables: Record<string, any>;
    [key: string]: any;
}