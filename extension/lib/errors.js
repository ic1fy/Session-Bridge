export class BridgeError extends Error {
  constructor(code, safeMessage) {
    super(safeMessage);
    this.name = "BridgeError";
    this.code = code;
    this.safeMessage = safeMessage;
  }
}
