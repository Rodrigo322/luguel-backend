import { DomainError } from "../../shared/errors/domain-error";
import type { ListingDeliveryMode } from "../../listings/entities/listing";
import type { RentalFulfillmentMethod } from "../entities/rental-payment";

export function ensureRentalFulfillmentAllowed(input: {
  listingDeliveryMode: ListingDeliveryMode;
  fulfillmentMethod: RentalFulfillmentMethod;
  deliveryAddress?: string;
}): void {
  if (input.listingDeliveryMode === "PICKUP" && input.fulfillmentMethod !== "PICKUP_LOCAL") {
    throw new DomainError("Listing accepts pickup only.", 400, "InvalidFulfillmentMethod");
  }

  if (input.listingDeliveryMode === "DELIVERY" && input.fulfillmentMethod === "PICKUP_LOCAL") {
    throw new DomainError("Listing accepts delivery only.", 400, "InvalidFulfillmentMethod");
  }

  if (input.fulfillmentMethod !== "PICKUP_LOCAL") {
    const normalizedAddress = input.deliveryAddress?.trim() ?? "";
    if (normalizedAddress.length < 8) {
      throw new DomainError("Delivery address is required for delivery fulfillment.", 400, "DeliveryAddressRequired");
    }
  }
}

