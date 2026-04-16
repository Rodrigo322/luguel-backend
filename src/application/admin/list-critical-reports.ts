import { listCriticalOpenReports } from "../../infra/persistence/in-memory-store";

export function listCriticalReports() {
  return listCriticalOpenReports();
}
