import type {
	AnyAuthConfig,
	AnyErpConfig,
} from "../../schemas/integrations.schema";

// client

export enum ClientStatus {
	ACTIVE = "ACTIVE",
	INACTIVE = "INACTIVE",
	UNKNOWN = "UNKNOWN",
	UNMAPPED_STATUS = "UNMAPPED_STATUS",
}

export interface Client {
	id: string;
	name: string;
	document?: string;
	phone?: string;
	status: ClientStatus;
}

// contract

export enum ContractStatus {
	ACTIVE = "ACTIVE",
	INACTIVE = "INACTIVE",
	UNKNOWN = "UNKNOWN",
	UNMAPPED_STATUS = "UNMAPPED_STATUS",
}

export interface Contract {
	id: string;
	status: ContractStatus;
}

// other stuff not yet planned properly
export interface ServiceOrder {
	id: string;
}

// base erp stuff

export interface ErpConfig {
	authConfig: AnyAuthConfig;
	erpConfig?: AnyErpConfig;
}

export type ErpConstructor = new (config: ErpConfig) => ErpAdapter;

// methods every erp must implement
export interface ErpAdapter {
	testConnection(): Promise<boolean>;

	searchClientByDocument(cpfCnpj: string): Promise<Client | null>;

	searchClientByPhone(phone: string): Promise<Client | null>;

	//   getClientContracts(clientId: string): Promise<Contract[]>;

	//   openServiceOrder(
	//     clientId: string,
	//     description: string,
	//   ): Promise<ServiceOrder>;
}
