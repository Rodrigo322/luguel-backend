import { listCriticalOpenReports } from "../../infra/persistence/in-memory-store";

export async function listCriticalReports() {
  return listCriticalOpenReports();
}
