import type { Prisma } from "@prisma/client";

export interface JwtPayload {
	userId: string;
	email: string;
}

export type StepResult = {
    nodeId: string;
    type: string;
    status: "success" | "error";
    durationMs: number;
    output?: string;
    error?: string;
} & Record<string, Prisma.JsonValue>;

export type ExecutionSnapshot = {
    variables: Record<string, Prisma.JsonValue>;
    steps: StepResult[];
} & Record<string, Prisma.JsonValue>;