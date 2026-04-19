import { createHash } from "node:crypto";
import { DomainError } from "../../shared/errors/domain-error";

export function buildRentalContractText(input: {
  rentalId: string;
  listingId: string;
  tenantId: string;
  ownerId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  depositAmount: number;
}): string {
  return [
    "LUGUEL DIGITAL RENTAL TERMS v1.0",
    `Rental: ${input.rentalId}`,
    `Listing: ${input.listingId}`,
    `Tenant: ${input.tenantId}`,
    `Owner: ${input.ownerId}`,
    `Start: ${input.startDate.toISOString()}`,
    `End: ${input.endDate.toISOString()}`,
    `TotalPrice: ${input.totalPrice.toFixed(2)}`,
    `DepositAmount: ${input.depositAmount.toFixed(2)}`,
    "By accepting this contract, both parties agree on digital terms and dispute handling by platform rules."
  ].join("\n");
}

export function generateContractChecksum(contractText: string): string {
  return createHash("sha256").update(contractText).digest("hex");
}

export function ensureContractAcceptableByActor(input: {
  requesterRole: "ADMIN" | "OWNER" | "TENANT";
}): void {
  if (input.requesterRole === "ADMIN") {
    throw new DomainError("Admin cannot accept contract on behalf of parties.", 403, "ContractAcceptForbidden");
  }
}

