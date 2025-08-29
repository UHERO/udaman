export type ActionResult<T> =
  | { error: null; data: T }
  | { error: string; data: null; statusCode?: number };

export const createActionResult = {
  success: <T>(data: T): ActionResult<T> => ({ error: null, data }),
  error: <T>(error: string, statusCode?: number): ActionResult<T> => ({
    error,
    data: null,
    statusCode,
  }),
};
