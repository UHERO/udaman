export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode?: number };

export const createActionResult = {
  success: <T>(data: T): ActionResult<T> => ({ success: true, data }),
  error: <T>(error: string, statusCode?: number): ActionResult<T> => ({
    success: false,
    error,
    statusCode,
  }),
};
