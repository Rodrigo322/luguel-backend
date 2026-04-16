import { listUsers } from "../../infra/persistence/in-memory-store";

export async function listUsersFlow() {
  return listUsers();
}
