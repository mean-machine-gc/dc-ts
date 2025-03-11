import { SafeParse, SafeParseFails } from "./parsing";
import { 
    acceptRes, 
    resToFn, 
    DoNothing, 
    Failure, 
    failWithRes, 
    isFailure, 
    Result, 
    splitRes, 
    acceptResPartial, 
    succeed, 
    fail 
} from "./result";

/**
 * Type representing possible failure messages for Core Workflows.
 */
export type CoreWfFails = SafeParseFails | HandlerFails | string;

/**
 * Represents a core workflow function that processes a command and state to produce a result.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template E The type of the event produced.
 * @template F The type of failure messages.
 */
export type CoreWfFn<C, S, E, F extends string> = (c: C) => (s: S) => Result<E, F>;

/**
 * A partial workflow function that only depends on the state to produce a result.
 * @template S The type of the state.
 * @template E The type of the event produced.
 * @template F The type of failure messages.
 */
export type PartialWf<S, E, F extends string> = (s: S) => Result<E, F>;

/**
 * Represents a Core Workflow with structured properties and functions.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template E The type of the event produced.
 * @template F The type of failure messages.
 */
export type CoreWf<C, S, E, F extends string = CoreWfFails> = {
    cmd: C;
    state: S;
    evt: E;
    fails: F;
    res: Result<E, F>;
    fn: CoreWfFn<C, S, E, F>;
    transition: CoreWfFn<C, S, E, F>;
    compose: CoreWfFn<C, S, E, F>;
    partialFn: PartialWf<S, E, F>;
    invariant: Invariant<C, S, F>;
    constrain: Constrain<C, S, F>;
};

type _AnyCoreWf = CoreWf<any, any, any, string>;

/**
 * A reducer function that transforms the current state to a result.
 * @template State The type of the current state.
 * @template Evt The type of the event produced.
 * @template Fails The type of failure messages.
 */
export type Reducer<State, Evt, Fails extends string> = 
    (currentState: State) => Result<Evt, Fails>;

/**
 * Represents possible failure messages for a command handler.
 */
export type HandlerFails = SafeParseFails | 'not_implemented' | 'cmd_does_not_exist';

/**
 * Defines a handler function that processes a command and returns a reducer function.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template E The type of the event produced.
 * @template F The type of failure messages.
 */
export type Handler<C, S, E, F extends string> = 
    (cmd: C) => Reducer<S, E, F> | ((a: any) => Failure<HandlerFails>);

/**
 * A handler that returns a failure indicating the command is not implemented.
 * @template W The workflow type.
 * @param {W['cmd']} c - The command.
 * @returns A failure result with "not_implemented".
 */
export const notImplemented = <W extends _AnyCoreWf>(c: W['cmd']) => (s: W['state']) => {
    return fail('not_implemented', c);
};

/**
 * Wraps a handler with command parsing to ensure only valid commands are processed.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template E The type of the event produced.
 * @template F The type of failure messages.
 * @param {SafeParse<C>} parseCmd - Function to safely parse the command.
 * @param {Handler<C, S, E, F>} fn - The handler function.
 * @returns A function that applies the handler only if command parsing succeeds.
 */
export const sanitizedHandler = <C, S, E, F extends string> 
    (parseCmd: SafeParse<C>) => 
    (fn: Handler<C, S, E, F>) => 
    (cmd: C) => {
        const cmdParseRes = parseCmd(cmd);
        return acceptResPartial<Handler<C, S, E, F>, C, SafeParseFails, Reducer<S, E, F>>(fn)(cmdParseRes);
    };

/**
 * Represents an invariant function that ensures a command and state conform to certain rules.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template F The type of failure messages.
 */
export type Invariant<C, S, F extends string> = (cmd: C) => (state: S) => Result<S, F>;

/**
 * Represents a constraint function that validates a command in a given state.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template F The type of failure messages.
 */
export type Constrain<C, S, F extends string = never> = (cmd: C) => (currState: S) => Result<S, F>;

/**
 * Applies a set of constraint functions to a command and state, returning the first failure encountered.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template F The type of failure messages.
 * @param {Constrain<C, S, F>[]} fns - An array of constraint functions.
 * @returns A function that applies the constraints sequentially.
 */
const applyConstrains = <C, S, F extends string>(fns: Constrain<C, S, F>[]) => (cmd: C) => (currState: S) => {
    const acc = fns.reduce((acc: any, fn) => {
        const res = fn(cmd)(currState);
        if (isFailure(res)) {
            if (!acc.failedOnce) {
                acc.failedOnce = true;
                acc.res = res;
            }
        }
        return acc;
    }, { failedOnce: false, res: succeed(currState) });

    return acc.res as Result<S, F>;
};

/**
 * Composes a workflow by applying parsing, invariants, constraints, and transition functions sequentially.
 * @template W The workflow type.
 * @param {SafeParse<W['state']>} _parsing - The parsing function for state validation.
 * @param {W['invariant']} _invariants - The invariant function ensuring preconditions.
 * @param {W['constrain'][]} _constrains - A set of constraints to validate state changes.
 * @param {W['transition']} _transition - The transition function that executes the workflow.
 * @returns A function that executes the workflow step by step.
 */
export const composeWf = <W extends _AnyCoreWf>
    (_parsing: SafeParse<W['state']>) => 
    (_invariants: W['invariant']) => 
    (_constrains: W['constrain'][]) =>
    (_trainsition: W['transition']) => 
    (cmd: W['cmd']) => 
    (currState: W['state']): W['res'] => {
        const parsingRes = _parsing(currState)
        const invariantsRes = acceptRes(_invariants(cmd))(parsingRes) as Result<W['state'], W['fails']>
        const constrainsRes = acceptRes(applyConstrains(_constrains)(cmd))(invariantsRes) as Result<W['state'], W['fails']>
        const transitionRes = acceptRes(_trainsition(cmd))(constrainsRes) as W['res']
        return transitionRes;
    };
