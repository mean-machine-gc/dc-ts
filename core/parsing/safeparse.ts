import { Result } from "../result";

export type SafeParse<T> = (data: T) => Result<T, SafeParseFails>
export type SafeParseFails = 'invalid_payload'