export class DomainError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = "DomainError"
  ) {
    super(message);
    this.name = "DomainError";
  }
}
