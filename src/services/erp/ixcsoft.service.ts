import axios, { type AxiosInstance } from "axios";
import { logger, toError } from "../../lib/logger";
import { formatCpfCnpj, formatPhone } from "../../utils/format.utils";
import {
	type Client,
	ClientStatus,
	type ErpAdapter,
	type ErpConfig,
} from "./erp.interface";

const serviceLogger = logger.child({ context: "IxcSoftService" });

const BASE_API_ENDPOINT = "/webservice/v1";

interface IxcResponse<T> {
	total: number;
	registros: T[];
	mensagem?: string;
	type?: "success" | "error";
}

export class IxcSoftService implements ErpAdapter {
	private baseUrl: string;
	private token: string;
	private client: AxiosInstance;

	constructor(config: ErpConfig) {
		this.baseUrl = config.authConfig.url.replace(/\/$/, "");
		this.token = config.authConfig.token;

		const auth = Buffer.from(this.token).toString("base64");

		this.client = axios.create({
			baseURL: `${this.baseUrl}${BASE_API_ENDPOINT}`,
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
		});

		// log de toda request
		this.client.interceptors.request.use((config) => {
			serviceLogger.debug("ixc request", {
				method: config.method?.toUpperCase(),
				url: config.url,
				params: config.params,
				data: config.data,
			});
			return config;
		});

		// log de toda response (sucesso e erro)
		this.client.interceptors.response.use(
			(response) => {
				const data = response.data;

				// IXC às vezes retorna 200 com HTML de erro
				if (
					typeof data === "string" &&
					data.includes("Ocorreu um erro ao processar")
				) {
					serviceLogger.error("ixc returned html error page", {
						method: response.config.method?.toUpperCase(),
						url: response.config.url,
						data,
					});
					throw new IxcApiError(
						"Ocorreu um erro ao processar. Contate o suporte IXC Soft.",
					);
				}

				serviceLogger.debug("ixc response", {
					method: response.config.method?.toUpperCase(),
					url: response.config.url,
					status: response.status,
					data,
				});

				return response;
			},
			(error) => {
				serviceLogger.error("ixc response error", {
					method: error.config?.method?.toUpperCase(),
					url: error.config?.url,
					status: error.response?.status,
					data: error.response?.data,
					err: toError(error),
				});
				return Promise.reject(error);
			},
		);
	}

	async request<T>(
		method: "GET" | "POST" | "PUT" | "DELETE",
		path: string,
		body?: unknown,
	): Promise<T> {
		const response = await this.client.request<T>({
			method,
			url: path,
			...(method === "GET"
				? { data: body, headers: { ixcsoft: "listar" } }
				: { data: body }),
		});

		return response.data;
	}

	async requestList<T = unknown>(path: string, body?: unknown): Promise<T[]> {
		const data = await this.request<IxcResponse<T>>("GET", path, body);

		if (data.type === "error") {
			throw new IxcApiError(data.mensagem ?? "Unknown IXC error");
		}

		return data.registros ?? [];
	}

	async testConnection(): Promise<boolean> {
		try {
			await this.requestList("/cliente", {
				qtype: "cliente.id",
				query: "1",
				oper: "=",
				limit: "1",
			});
			return true;
		} catch (err) {
			serviceLogger.error("ixc testConnection failed", { err: toError(err) });
			return false;
		}
	}

	async searchClientByPhone(phone: string): Promise<Client | null> {
		const formattedPhone = formatPhone(phone);
		const registros = await this.requestList("/cliente", {
			qtype: "cliente.telefone_celular",
			query: formattedPhone,
			oper: "=",
			limit: "3",
		});

		return registros[0] ? this.mapClient(registros[0]) : null;
	}

	async searchClientByDocument(cpfCnpj: string): Promise<Client | null> {
		const formattedDocument = formatCpfCnpj(cpfCnpj);
		const registros = await this.requestList("/cliente", {
			qtype: "cliente.cnpj_cpf",
			query: formattedDocument,
			oper: "=",
			limit: "3",
		});
		return registros[0] ? this.mapClient(registros[0]) : null;
	}

	/**
	 * Para verificar as propriedades existentes retornadas em raw, acesse:
	 * https://wikiapiprovedor.ixcsoft.com.br/
	 * - Cadastros > Clientes
	 */
	private mapClient(raw: unknown): Client {
		const r = raw as Record<string, unknown>;
		return {
			id: String(r.id),
			name: String(r.razao ?? r.nome),
			document: r.cnpj_cpf ? String(r.cnpj_cpf) : undefined,
			phone: r.telefone_celular
				? String(r.telefone_celular)
				: r.fone_res
					? String(r.fone_res)
					: undefined,
			status: this.mapClientStatus(String(r.ativo)) ?? ClientStatus.UNKNOWN,
		};
	}

	/**
	 * https://wikiapiprovedor.ixcsoft.com.br/
	 * - Cadastros > Clientes > "ativo"
	 * S = Sim
	 * N = Não
	 */
	private mapClientStatus(status: string): ClientStatus | null {
		switch (status) {
			case "S":
				return ClientStatus.ACTIVE;
			case "N":
				return ClientStatus.INACTIVE;
			default:
				serviceLogger.warn(`unmapped client status: ${status}`);
				return ClientStatus.UNMAPPED_STATUS;
		}
	}
}

export class IxcRequestError extends Error {
	constructor(
		public method: string,
		public url: string,
		public statusCode: number,
		public body: string,
	) {
		super(`IXC request failed: ${method} ${url} → ${statusCode}`);
		this.name = "IxcRequestError";
	}
}

export class IxcApiError extends Error {
	constructor(message: string) {
		super(`IXC API error: ${message}`);
		this.name = "IxcApiError";
	}
}
