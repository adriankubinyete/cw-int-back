import type { ExecutionContext } from "../services/nodes/node.interface";

export function formatCpfCnpj(value: string): string {
	const digits = value.replace(/\D/g, "");

	if (digits.length === 11) {
		return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
	}

	if (digits.length === 14) {
		return digits.replace(
			/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
			"$1.$2.$3/$4-$5",
		);
	}

	return value;
}

export function formatPhone(value: string): string {
	const digits = value.replace(/\D/g, "");

	if (digits.length === 11) {
		return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
	}

	if (digits.length === 10) {
		return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
	}

	return value;
}

// resolve "{{contact.name}}" → context.contact.name
export function resolveVariable(expression: string, context: ExecutionContext): any {
    const match = expression.match(/\{\{(.+?)\}\}/);
    if (!match) return expression;

	// @ts-expect-error
    const parts = match[1].trim().split(".");
    let value: any = context;

    for (const part of parts) {
        value = value?.[part];
    }

    return value;
}

// substitui {{contact.name}}, {{client.id}}, etc. pelo valor do contexto
export function interpolate(template: string, context: ExecutionContext): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, path) => {
        const value = resolveVariable(`{{${path.trim()}}}`, context);
        return value !== undefined && value !== null ? String(value) : "";
    });
}