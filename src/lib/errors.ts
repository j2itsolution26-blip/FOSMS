/** Thrown by services for business-rule violations; route handlers translate this into a structured API error. */
export class AppError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class ReservationConflictError extends AppError {
  constructor(message = "This room is already reserved for the selected dates.") {
    super(message, "RESERVATION_CONFLICT", 409);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.") {
    super(message, "NOT_FOUND", 404);
  }
}
