import { AsyncResult, isFailure, Result } from "../core";

/**
 * Observes a synchronous function execution and logs the result using a tracer and logger.
 * @template T The type of successful result data.
 * @template F The type of failure message.
 * @param {object} ctx - The execution context containing a tracer and a logger.
 * @param {any} ctx.tracer - The tracing utility.
 * @param {any} ctx.logger - The logging utility.
 * @returns A function that wraps a synchronous function with observation logic.
 */
const innerSync = <T, F extends string>(ctx: { tracer: any; logger: any }) => 
    (msg: string) => 
    (fn: Function) => 
    (c: any) => 
    (span: any): Result<T, F> => {
        const res = fn(c) as Result<T, F>;
        span.addEvent(`Result: ${res.outcome}`, JSON.stringify(res));

        if (isFailure(res)) {
            ctx.logger.warn(`${msg} failed: `, JSON.stringify(res));
        } else {
            ctx.logger.info(`${msg} succeeded: `, JSON.stringify(res));
        }

        span.end();
        return res as Result<T, F>;
    };

/**
 * Observes an asynchronous function execution and logs the result using a tracer and logger.
 * @template T The type of successful result data.
 * @template F The type of failure message.
 * @param {object} ctx - The execution context containing a tracer and a logger.
 * @param {any} ctx.tracer - The tracing utility.
 * @param {any} ctx.logger - The logging utility.
 * @returns A function that wraps an asynchronous function with observation logic.
 */
const innerAsync = <T, F extends string>(ctx: { tracer: any; logger: any }) => 
    (msg: string) => 
    (fn: Function) => 
    (c: any) => 
    async (span: any): AsyncResult<T, F> => {
        const res = await fn(c) as Result<T, F>;
        span.addEvent(`Result: ${res.outcome}`, JSON.stringify(res));

        if (isFailure(res)) {
            ctx.logger.warn(`${msg} failed: `, JSON.stringify(res));
        } else {
            ctx.logger.info(`${msg} succeeded: `, JSON.stringify(res));
        }

        span.end();
        return res as Result<T, F>;
    };

/**
 * Wraps a synchronous function execution with logging and optional tracing.
 * @template T The type of successful result data.
 * @template F The type of failure message.
 * @param {object} ctx - The execution context containing a tracer and a logger.
 * @param {any} ctx.tracer - The tracing utility.
 * @param {any} ctx.logger - The logging utility.
 * @returns A function that observes a synchronous function execution.
 */
export const observeSync = (ctx: { tracer: any; logger: any }) =>  
    <T, F extends string>(msg: string) => 
    (fn: Function) =>  
    (c: any): Result<T, F> => {
        if (!!ctx.tracer && !!ctx.logger.startActiveSpan && !!ctx.logger && ctx.logger.info && ctx.logger.warn) {
            const attributes = !!c.msgType && c.msgType == 'cmd' && c.data
                ? { ...c, data: JSON.stringify(c.data) }
                : { params: JSON.stringify(c) };

            const _inner = innerSync<T, F>(ctx)(msg)(fn)(c);
            return ctx.tracer.startActiveSpan(msg, attributes, (span) => _inner(span));
        } else if (!!ctx.logger && !!ctx.logger.info && ctx.logger.warn) {
            const res = fn(c) as Result<T, F>;
            if (isFailure(res)) {
                ctx.logger.warn(`${msg} failed: `, JSON.stringify(res));
            } else {
                ctx.logger.info(`${msg} succeeded: `, JSON.stringify(res));
            }
            return res;
        } else {
            return fn(c) as Result<T, F>;
        }
    };

/**
 * Wraps an asynchronous function execution with logging and optional tracing.
 * @template T The type of successful result data.
 * @template F The type of failure message.
 * @param {object} ctx - The execution context containing a tracer and a logger.
 * @param {any} ctx.tracer - The tracing utility.
 * @param {any} ctx.logger - The logging utility.
 * @returns A function that observes an asynchronous function execution.
 */
export const observeAsync = (ctx: { tracer: any; logger: any }) =>  
    <T, F extends string>(msg: string) => 
    (fn: Function) =>  
    async (c: any): AsyncResult<T, F> => {
        if (!!ctx.tracer && !!ctx.logger.startActiveSpan && !!ctx.logger && ctx.logger.info && ctx.logger.warn) {
            const attributes = !!c.msgType && c.msgType == 'cmd' && c.data
                ? { ...c, data: JSON.stringify(c.data) }
                : { params: JSON.stringify(c) };

            const _inner = innerAsync<T, F>(ctx)(msg)(fn)(c);
            return await ctx.tracer.startActiveSpan(msg, attributes, async (span) => _inner(span));
        } else if (!!ctx.logger && !!ctx.logger.info && ctx.logger.warn) {
            const res = await fn(c) as Result<T, F>;
            if (isFailure(res)) {
                ctx.logger.warn(`${msg} failed: `, JSON.stringify(res));
            } else {
                ctx.logger.info(`${msg} succeeded: `, JSON.stringify(res));
            }
            return res;
        } else {
            return await fn(c) as Result<T, F>;
        }
    };
