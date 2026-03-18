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
