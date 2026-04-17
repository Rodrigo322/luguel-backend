export const USER_ROLES = ["LOCADOR", "LOCATARIO", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];
