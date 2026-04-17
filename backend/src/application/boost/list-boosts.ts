import { listBoostRecords } from "../../infra/persistence/in-memory-store";

export async function listBoostsFlow() {
  return listBoostRecords();
}
