import { listRentalRecords, listRentalsByUser } from "../../infra/persistence/in-memory-store";
import type { UserRole } from "../../shared/types/role";

interface ListRentalsInput {
  requesterId: string;
  requesterRole: UserRole;
}

export async function listRentals(input: ListRentalsInput) {
  if (input.requesterRole === "ADMIN") {
    return listRentalRecords();
  }

  return listRentalsByUser(input.requesterId);
}
