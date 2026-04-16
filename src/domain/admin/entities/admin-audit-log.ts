export interface AdminAuditLog {
  id: string;
  adminId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
