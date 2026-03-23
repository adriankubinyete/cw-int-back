// src/services/nodes/node.registry.ts
import type { NodeHandler } from "./node.interface";
import { SendMessageNode } from "./send-message.node";
import { SearchClientNode } from "./search-client.node";
import { ConditionNode } from "./condition.node";
import { AskInputNode } from "./ask-input.node";

const handlers: NodeHandler[] = [
    new SendMessageNode(),
    new SearchClientNode(),
    new ConditionNode(),
    new AskInputNode(),
];

export const nodeRegistry = {
    // pra UI: GET /api/nodes/registry
    definitions: handlers.map((h) => h.definition),

    // pro executor: despacha pelo tipo
    get(type: string): NodeHandler {
        const handler = handlers.find((h) => h.definition.type === type);
        if (!handler) throw new Error(`Unknown node type: "${type}"`);
        return handler;
    },
};