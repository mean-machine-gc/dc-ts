/**
 * A type representing an asynchronous result, which can either be a success or failure.
 * @template T The type of data returned on success.
 * @template F The type of failure message.
 */
export type AsyncResult<T, F extends string> = Promise<Result<T, F>>;

/**
 * A union type representing either a success or failure outcome.
 * @template T The type of data returned on success.
 * @template F The type of failure message.
 */
export type Result<T, F extends string> = Success<T> | Failure<F>;

/**
 * Represents a successful operation.
 * @template T The type of data returned on success.
 */
export type Success<T> = { outcome: 'success'; data: T };

/**
 * Represents a failed operation.
 * @template F The type of failure message.
 */
export type Failure<F extends string> = { outcome: 'failure'; cause: Cause<F>[] };

/**
 * Represents a failure cause.
 * @template F The type of failure message.
 */
export type Cause<F extends string> = { msg: F; data?: any };

/**
 * Creates a failure result with a single cause.
 * @template F The type of failure message.
 * @param {F} msg - The failure message.
 * @param {any} [data] - Optional additional data related to the failure.
 * @returns {Failure<F>} A failure result object.
 */
export const fail = <F extends string>(msg: F, data?: any): Failure<F> => {
    return { outcome: 'failure', cause: [{ msg, data }] } as Failure<F>;
};

/**
 * Creates a failure result with multiple causes.
 * @template F The type of failure message.
 * @param {Cause<F>[]} cause - An array of failure causes.
 * @returns {Failure<F>} A failure result object.
 */
export const failMany = <F extends string>(cause: Cause<F>[]): Failure<F> => {
    return { outcome: 'failure', cause } as Failure<F>;
};

/**
 * Returns the given failure result as is.
 * @template F The type of failure message.
 * @param {Failure<F>} res - The existing failure result.
 * @returns {Failure<F>} The unchanged failure result.
 */
export const failWithRes = <F extends string>(res: Failure<F>): Failure<F> => {
    return res as Failure<F>;
};

/**
 * Creates a success result with the provided data.
 * @template T The type of data to be returned on success.
 * @param {T} data - The successful result data.
 * @returns {Success<T>} A success result object.
 */
export const succeed = <T>(data: T): Success<T> => {
    return { outcome: 'success', data } as Success<T>;
};

/**
 * Checks if the given result represents a failure.
 * @template T The type of success data.
 * @template F The type of failure message.
 * @param {Result<T, F>} res - The result to check.
 * @returns {boolean} True if the result is a failure, false otherwise.
 */
export const isFailure = <T, F extends string>(res: Result<T, F>): boolean => res?.outcome === 'failure';

/**
 * Checks if the given result represents a success.
 * @template T The type of success data.
 * @template F The type of failure message.
 * @param {Result<T, F>} res - The result to check.
 * @returns {boolean} True if the result is a success, false otherwise.
 */
export const isSuccess = <T, F extends string>(res: Result<T, F>): boolean => res?.outcome === 'success';

/**
 * A function type that takes a function and applies it to a result if it's a success.
 * @template Fn The function type to apply.
 * @template T The type of success data.
 * @template F The type of failure message.
 * @template R The return type of the applied function.
 */
type AcceptRes = <Fn extends Function, T, F extends string, R>(fn: Fn) => (res: Result<T, F>) => R | Failure<F>;

/**
 * Applies a function to the success value of a result, returning a failure if the result is a failure.
 * @template Fn The function type to apply.
 * @template T The type of success data.
 * @template F The type of failure message.
 * @param {Fn} fn - The function to apply.
 * @returns A function that takes a result and applies the function to its success value.
 */
export const acceptRes: AcceptRes = <Fn extends Function, T, F extends string>(fn: Fn) => (res: Result<T, F>) => {
    if (isFailure(res)) {
        return res;
    }
    return fn(res['data']);
};

/**
 * A type representing a function that either executes normally or returns a failure.
 * @template Fn The function type.
 * @template F The type of failure message.
 */
export type FnOrNothing<Fn extends Function, T, F extends string> = Fn | ((a: any) => Result<T, F>);

/**
 * A function type that applies a function to a successful result and returns a function or a failure.
 * @template Fn The function type to apply.
 * @template T The type of success data.
 * @template F The type of failure message.
 * @template R The function type returned.
 */
type AcceptResPartial = <Fn extends Function, T, F extends string, R extends Function>(
    fn: Fn
) => (res: Result<T, F>) => FnOrNothing<R, T, F>;

/**
 * Applies a function to the success value of a result and returns a function or a failure.
 * @template Fn The function type to apply.
 * @template T The type of success data.
 * @template F The type of failure message.
 * @template R The function type returned.
 * @param {Fn} fn - The function to apply.
 * @returns A function that takes a result and applies the function to its success value.
 */
export const acceptResPartial: AcceptResPartial = <Fn extends Function, T, F extends string, R>(
    fn: Fn
) => (res: Result<T, F>) => {
    if (isFailure(res)) {
        return doNothing<Result<T, F>>(res);
    }
    return fn(res['data']) as R;
};

/**
 * A function type that does nothing and returns the original value.
 * @template A The input type.
 */
export type DoNothing<A> = (a: A) => (b: any) => A;

/**
 * Returns a function that always returns the given value, ignoring its second argument.
 * @template A The input type.
 * @param {A} a - The value to return.
 * @returns A function that returns `a` regardless of input.
 */
export const doNothing = <A>(a: A) => (b: any) => a;

/**
 * A function type that converts a result containing a function into a function.
 * @template T The function type.
 * @template F The type of failure message.
 */
type ResToFn = <T extends Function, F extends string>(res: Result<T, F>) => T | ((a: any) => Failure<F>);

/**
 * Converts a successful result containing a function into the function itself, or returns a no-op failure function.
 * @template T The function type.
 * @template F The type of failure message.
 * @param {Result<T, F>} res - The result containing a function.
 * @returns The function if the result is a success, otherwise a failure function.
 */
export const resToFn: ResToFn = <T extends Function, F extends string>(res: Result<T, F>) => {
    if (isFailure(res)) {
        return doNothing<Result<T, F>>(res);
    }
    return res['data'];
};

/**
 * A function type that extracts the success data or returns a failure.
 * @template T The type of success data.
 * @template F The type of failure message.
 */
type SplitRes = <T, F extends string>(res: Result<T, F>) => T | Failure<F>;

/**
 * Extracts the success data from a result or returns a failure.
 * @template T The type of success data.
 * @template F The type of failure message.
 * @param {Result<T, F>} res - The result to process.
 * @returns The success data if present, otherwise the failure.
 */
export const splitRes: SplitRes = <T, F extends string>(res: Result<T, F>) => {
    if (isFailure(res)) {
        return res;
    }
    return res['data'];
};
