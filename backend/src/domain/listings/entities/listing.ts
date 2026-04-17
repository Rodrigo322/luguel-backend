export type ListingStatus = "ACTIVE" | "PENDING_VALIDATION" | "FLAGGED" | "SUSPENDED" | "ARCHIVED";
export type ListingDeliveryMode = "PICKUP" | "DELIVERY" | "BOTH";
export type ListingBookingMode = "IMMEDIATE" | "SCHEDULED" | "BOTH";

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string;
  city?: string;
  region?: string;
  dailyPrice: number;
  deliveryMode: ListingDeliveryMode;
  bookingMode: ListingBookingMode;
  status: ListingStatus;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
