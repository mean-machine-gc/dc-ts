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
 * Type representing possible failure messages for Core Policies.
 */
export type CorePyFails = SafeParseFails | string;

/**
 * Represents a core policy function that processes a command and state to produce a result.
 * @template C The type of the command produced.
 * @template S The type of the state.
 * @template E The type of the event.
 * @template F The type of failure messages.
 */
export type CorePyFn<E, S, C, F extends string> = (e: E) => (s: S) => Result<C, F>;

/**
 * A partial policy function that only depends on the state to produce a result.
 * @template S The type of the state.
 * @template C The type of the cmd produced.
 * @template F The type of failure messages.
 */
export type PartialPy<S, C, F extends string> = (s: S) => Result<C, F>;

/**
 * Represents a Core Policy with structured properties and functions.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template E The type of the event.
 * @template F The type of failure messages.
 */
export type CorePy<E, S, C, F extends string = CorePyFails> = {
    cmd: C;
    state: S;
    evt: E;
    fails: F;
    res: Result<C, F>;
    fn: CorePyFn<E, S, C, F>;
    execute: CorePyFn<E, S, C, F>;
    compose: CorePyFn<E, S, C, F>;
    partialFn: PartialPy<S, C, F>;
    invariant: InvariantPy<E, S, F>;
    constrain: ConstrainPy<E, S, F>;
};

type _AnyCorePy = CorePy<any, any, any, string>;

/**
 * Represents an invariant function that ensures a event and state conform to certain rules.
 * @template E The type of the evt.
 * @template S The type of the state.
 * @template F The type of failure messages.
 */
export type InvariantPy<E, S, F extends string> = (evt: E) => (state: S) => Result<S, F>;

/**
 * Represents a constraint function that validates some conditions in a given state.
 * @template E The type of the command.
 * @template S The type of the state.
 * @template F The type of failure messages.
 */
export type ConstrainPy<E, S, F extends string = never> = (evt: E) => (currState: S) => Result<S, F>;

/**
 * Applies a set of constraint functions to a evt and state, returning the first failure encountered.
 * @template E The type of the evt.
 * @template S The type of the state.
 * @template F The type of failure messages.
 * @param {ConstrainPy<E, S, F>[]} fns - An array of constraint functions.
 * @returns A function that applies the constraints sequentially.
 */
const applyConstrainsPy = <E, S, F extends string>(fns: ConstrainPy<E, S, F>[]) => (evt: E) => (currState: S) => {
    const acc = fns.reduce((acc: any, fn) => {
        const res = fn(evt)(currState);
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
 * Composes a policy by applying parsing, invariants, constraints, and transition functions sequentially.
 * @template W The workflow type.
 * @param {SafeParse<W['state']>} _parsing - The parsing function for state validation.
 * @param {W['invariant']} _invariants - The invariant function ensuring preconditions.
 * @param {W['constrain'][]} _constrains - A set of constraints to validate state changes.
 * @param {W['transition']} _transition - The transition function that executes the workflow.
 * @returns A function that executes the workflow step by step.
 */
export const composePy = <P extends _AnyCorePy>
    (_parsing: SafeParse<P['state']>) => 
    (_invariants: P['invariant']) => 
    (_constrains: P['constrain'][]) =>
    (_execute: P['execute']) => 
    (evt: P['evt']) => 
    (currState: P['state']): P['res'] => {
        const parsingRes = _parsing(currState)
        const invariantsRes = acceptRes(_invariants(evt))(parsingRes) as Result<P['state'], P['fails']>
        const constrainsRes = acceptRes(applyConstrainsPy(_constrains)(evt))(invariantsRes) as Result<P['state'], P['fails']>
        const executeRes = acceptRes(_execute(evt))(constrainsRes) as P['res']
        return executeRes;
    };
