import type { IntegrationType } from "@prisma/client";
import type { ErpConstructor } from "./erp.interface";
import { IxcSoftService } from "./ixcsoft.service";

export const erpRegistry: Partial<Record<IntegrationType, ErpConstructor>> = {
	IXCSOFT: IxcSoftService,
};
