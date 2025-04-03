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
 * @template iS The type of the input state.
 * @template E The type of the event produced.
 * @template oS The type of the output state.
 * @template F The type of failure messages.
 */
export type CoreWf<C, iS, E, oS, F extends string = CoreWfFails> = {
    cmd: C;
    inState: iS;
    evt: E;
    outState: oS;
    fails: F;
    executeRes: Result<{evt:E[], state: oS}, F>
    parseState: SafeParse<iS>
    constrain: Constrain<C, iS, F>
    execute: Execute<C, iS, E, oS, F>
    decide: Decide<C, iS, E, F>
    evolve: Evolve<E, iS, oS>
    safeEvolve: SafeEvolve<E, iS, oS>
    wf: {
        execute: Execute<C, iS, E, oS, F>
        decide: Decide<C, iS, E, F>
        evolve: SafeEvolve<E, iS, oS>
    }    
    compose: 
        (p: SafeParse<iS>) =>
        (c: Constrain<C, iS, F>[]) => 
        (d: Decide<C, iS, E, F>) => 
        (e: Evolve<E, iS, oS>) => 
            {
                execute: Execute<C, iS, E, oS, F>,
                decide: Decide<C, iS, E, F>,
                evolve: SafeEvolve<E, iS, oS>,
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
 * @template iS The type of the initial state.
 * @template oS The type of the output state.
 * @template F The type of failure messages.
 */
export type Evolve<E, iS, oS> = (e: E) => (s: iS) => oS

/**
 * Represents the evolution of the aggregate state following domain events, but it also checks the validity of the input state, hence it can return a SafeParseFails failure.
 * @template E The type of the event.
 * @template iS The type of the initial state.
 * @template oS The type of the output state.
 * @template F The type of failure messages.
 */
export type SafeEvolve<E, iS, oS> = (e: E) => (s: iS) => Result<oS, SafeParseFails>

/**
 * This function type chains a workflow decide and evolve function, it is a shorthand to receive both the events and the new state in a single invocation.
 * @template E The type of the event.
 * @template iS The type of the initial state.
 * @template oS The type of the output state.
 * @template F The type of failure messages.
 */
export type Execute<C, iS, E, oS, F extends string> = (c: C) => (s: iS) => Result<{evt:E[], state: oS}, F>

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
    (_parseState: SafeParse<W['inState']>) => 
    (_constrains: W['constrain'][]) =>
    (_decide: W['decide']) => 
    (_evolve: W['evolve']): W['wf'] => {
        
        const execute: W['execute'] = (c: W['cmd']) => (s: W['inState']) => {
            const parsingRes = _parseState(s)
            const constrainsRes = acceptRes(applyConstrains(_constrains)(c))(parsingRes) as Result<W['inState'], W['fails']>
            const decideRes = acceptRes(_decide(c))(constrainsRes) as Result<W['evt'][], W['fails']>
            if(isFailure(decideRes)){
                return failWithRes<W['fails']>(decideRes as Failure<W['fails']>)
            }
            const evt = decideRes['data'] as W['evt'][]
            const state = evt.reduce(_evolve, s) as W['outState']
            return succeed({evt, state})
        }

        const decide: W['decide'] = (c: W['cmd']) => (s: W['inState']) => {
            const parsingRes = _parseState(s)
            const constrainsRes = acceptRes(applyConstrains(_constrains)(c))(parsingRes) as Result<W['inState'], W['fails']>
            const decideRes = acceptRes(_decide(c))(constrainsRes) as Result<W['evt'][], W['fails']>
            return decideRes
        }

        const evolve: W['safeEvolve'] = (e: W['evt']) => (s: W['inState']) => {
            const parsingRes = _parseState(s)
            const stateRes = acceptRes(_evolve(e))(parsingRes) as Result<W['outState'], SafeParseFails>
            return stateRes
        }

        return {
            execute,
            decide,
            evolve
        }
    };
