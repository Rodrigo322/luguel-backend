export type ListingAvailabilityStatus = "FREE" | "BLOCKED";

export interface ListingAvailabilitySlot {
  id: string;
  listingId: string;
  date: Date;
  status: ListingAvailabilityStatus;
  pickupTime?: string;
  returnTime?: string;
  createdAt: Date;
  updatedAt: Date;
}
