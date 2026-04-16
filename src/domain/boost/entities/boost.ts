export type BoostStatus = "PENDING" | "PAID" | "ACTIVE" | "EXPIRED" | "CANCELED";

export interface Boost {
  id: string;
  listingId: string;
  status: BoostStatus;
  amount: number;
  startsAt?: Date;
  endsAt?: Date;
}
