// src/services/nodes/condition.node.ts
import type { NodeHandler, NodeExecutionContext, NodeExecutionResult } from "./node.interface";
import { logger } from "../../lib/logger";
import { resolveVariable } from "../../utils/format.utils";

const nodeLogger = logger.child({ context: "ConditionNode" });

type Operator = "exists" | "not_exists" | "equals" | "contains";

export class ConditionNode implements NodeHandler {
    definition = {
        type: "condition",
        label: "Condição",
        description: "Divide o fluxo com base em uma condição.",
        category: "logic" as const,
        icon: "GitBranch",
        configSchema: [
            {
                key: "variable",
                label: "Variável",
                type: "text" as const,
                required: true,
                placeholder: "{{client.name}}",
            },
            {
                key: "operator",
                label: "Operador",
                type: "select" as const,
                required: true,
                options: [
                    { label: "existe", value: "exists" },
                    { label: "não existe", value: "not_exists" },
                    { label: "igual a", value: "equals" },
                    { label: "contém", value: "contains" },
                ],
            },
            {
                key: "value",
                label: "Valor",
                type: "text" as const,
                required: false,
                placeholder: "deixe vazio para 'existe / não existe'",
            },
        ],
        outputs: [
            { key: "true", label: "Verdadeiro" },
            { key: "false", label: "Falso" },
        ],
    };

    async execute({ node, execution }: NodeExecutionContext): Promise<NodeExecutionResult> {
        const { variable, operator, value } = node.data as {
            variable: string;
            operator: Operator;
            value?: string;
        };

        if (!variable) throw new Error("condition: campo 'variable' é obrigatório");
        if (!operator) throw new Error("condition: campo 'operator' é obrigatório");

        const resolved = resolveVariable(variable, execution);
        const result = this.evaluate(resolved, operator, value);

        nodeLogger.debug("condition evaluated", {
            nodeId: node.id,
            variable,
            operator,
            value,
            resolved,
            result,
        });

        return { output: result ? "true" : "false" };
    }

    private evaluate(resolved: any, operator: Operator, value?: string): boolean {
        switch (operator) {
            case "exists":
                return resolved !== null && resolved !== undefined && resolved !== "";
            case "not_exists":
                return resolved === null || resolved === undefined || resolved === "";
            case "equals":
                return String(resolved) === String(value ?? "");
            case "contains":
                return String(resolved).includes(String(value ?? ""));
        }
    }
}