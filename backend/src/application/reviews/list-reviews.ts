import { listReviewRecords } from "../../infra/persistence/in-memory-store";

export async function listReviewsFlow() {
  return listReviewRecords();
}
