export interface Review {
  id: string;
  listingId: string;
  rentalId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
}
