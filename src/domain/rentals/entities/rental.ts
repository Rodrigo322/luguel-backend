export type RentalStatus =
  | "REQUESTED"
  | "APPROVED"
  | "ACTIVE"
  | "COMPLETED"
  | "CANCELED"
  | "DISPUTED";

export interface Rental {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: RentalStatus;
}
