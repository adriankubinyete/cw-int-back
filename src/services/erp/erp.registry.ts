import { ErpType } from "@prisma/client";
import type { ErpAdapter, ErpConstructor } from "./erp.interface";
import { IxcSoftService } from "./ixcsoft.service";

export const erpRegistry: Partial<Record<ErpType, ErpConstructor>> = {
  IXCSOFT: IxcSoftService
}