export class ServiceError extends Error {
  constructor(code, safeMessage, statusCode = 400) {
    super(safeMessage);
    this.name = "ServiceError";
    this.code = code;
    this.safeMessage = safeMessage;
    this.statusCode = statusCode;
  }
}

