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
export type CoreWfFails = SafeParseFails | string;

/**
 * Represents a Core Workflow with structured properties and functions.
 * @template C The type of the command.
 * @template A The type of the state (the Aggregate).
 * @template E The type of the event produced.
 * @template oS The type of the output state.
 * @template F The type of failure messages.
 */
export type CoreWf<C, iA, E, oA, F extends string = CoreWfFails> = {
    cmd: C
    inputAg: iA
    outputAg: oA
    aggregate: iA | oA
    evt: E
    fails: F
    validateAggregate: SafeParse<iA | oA>
    constrain: Constrain<C, iA | oA, F>
    decide: Decide<C, iA | oA, E, F>
    wf: {
        decide: Decide<C, iA | oA, E, F>
        validateOutputState: SafeParse<iA | oA>
    }    
    compose: 
        (p: SafeParse<iA | oA>) =>
        (c: Constrain<C, iA | oA, F>[]) => 
        (d: Decide<C, iA | oA, E, F>) => 
            {
                decide: Decide<C, iA | oA, E, F>,
                validateOutputState: SafeParse<iA | oA>
            }
};

/**
 * A dummy Core Workflow to make it easier to build the associated types and functions
 */
type _AnyCoreWf = CoreWf<any, any, any, any, string>;


/**
 * Represents a constraint function that validates a command in a given state. Return the success of the state if all goes well.
 * @template C The type of the command.
 * @template S The type of the state.
 * @template F The type of failure messages.
 */
export type Constrain<C, S, F extends string = never> = (cmd: C) => (currState: S) => Result<S, F>;

/**
 * Represents the decision of which events should be created (what happened in the system)
 * @template C The type of the command.
 * @template iS The type of the initial state.
 * @template E A union type of the events that can be generated.
 * @template F The type of failure messages.
 */
export type Decide<C, iS, E, F extends string> = (c: C) => (s: iS) => Result<E[], F>

/**
 * Represents the evolution of the aggregate state following domain events.
 * @template E The type of the event.
 * @template A The type of the state (the Aggregate).
 * @template F The type of failure messages.
 */
export type Evolve<E, A> = (e: E) => (a: A) => A

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

export const composeWf = <W extends _AnyCoreWf>
    (_validateInputState: SafeParse<W['aggregate']>) => 
    (_constrains: W['constrain'][]) =>
    (_decide: W['decide']) => 
    (validateOutputState: SafeParse<W['aggregate']>): W['wf'] => {
        
        const decide: W['decide'] = (c: W['cmd']) => (s: W['aggregate']) => {
            const parsingRes = _validateInputState(s)
            const constrainsRes = acceptRes(applyConstrains(_constrains)(c))(parsingRes) as Result<W['aggregate'], W['fails']>
            const decideRes = acceptRes(_decide(c))(constrainsRes) as Result<W['evt'][], W['fails']>
            return decideRes
        }

        return {
            decide,
            validateOutputState
        }
    };
