/**
 * Turns an API error into a message for the person using the page. Each app
 * owns its table of error messages, so the parts take this from the app.
 */
export type FormatError = (error: unknown) => string;
