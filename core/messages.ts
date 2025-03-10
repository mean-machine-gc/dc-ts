import { SafeParse, SafeParseFails } from "./parsing";
import { acceptRes, acceptResPartial, failWithRes, FnOrNothing, isFailure, resToFn, Result, fail } from "./result";
import { v4 as uuid } from "uuid";

/**
 * Represents the type of a message in the domain.
 */
type MsgType = "cmd" | "evt";

/**
 * Generic message structure for domain events and commands.
 * @template M The type of message ('cmd' or 'evt').
 * @template T The specific type of command or event.
 * @template D The payload data associated with the message.
 */
type Msg<M extends MsgType, T extends string, D> = {
    id: string;
    msgType: M;
    type: T;
    timestamp: number;
    correlationid: string;
    causationid: string | undefined;
    data: D;
};

/**
 * Type representing a domain command.
 * @template T The type of command.
 * @template D The payload data.
 */
export type CMD<T extends string, D> = Msg<"cmd", T, D>;

/**
 * Type representing a domain event.
 * @template T The type of event.
 * @template D The payload data.
 */
export type EVT<T extends string, D> = Msg<"evt", T, D>;

/**
 * Represents the domain trace information for tracking causation and correlation of messages.
 */
export type DomainTrace = {
    correlationid: string | undefined;
    causationid: string | undefined;
};

/**
 * Function signature for creating new messages.
 * @template M The type of message ('cmd' or 'evt').
 * @template T The type of command or event.
 * @template D The payload data.
 */
type NewMsg = <M extends MsgType, T extends string, D>(
    msgType: M
) => (type: T) => (domaintrace: DomainTrace) => (data: D) => Msg<M, T, D>;

/**
 * Creates a new message (command or event) with a unique ID and timestamp.
 * @template M The type of message ('cmd' or 'evt').
 * @template T The type of command or event.
 * @template D The payload data.
 * @returns A new message object.
 */
const newMsg: NewMsg = <M extends MsgType, T extends string, D>(
    msgType: M
) => (type: T) => (domaintrace: DomainTrace) => (data: D) => {
    return {
        id: uuid(),
        msgType,
        type,
        timestamp: Date.now(),
        ...domaintrace,
        data,
    };
};

/**
 * Cleans a domain trace by resetting correlation and causation IDs where necessary.
 * @param {DomainTrace} dt The domain trace to clean.
 * @returns A new cleaned domain trace object.
 */
const cleanDT = (dt: DomainTrace): DomainTrace => {
    const newCorr = { correlationid: uuid() };
    const newCaus = { causationid: undefined };
    const newDT: DomainTrace = { ...newCorr, ...newCaus };

    if (!dt) {
        return newDT;
    }
    if (!dt.correlationid) {
        return { ...newCorr, causationid: dt.causationid };
    }
    return dt;
};

/**
 * Extracts a new domain trace from an existing message.
 * @template M The type of message ('cmd' or 'evt').
 * @template T The type of command or event.
 * @template D The payload data.
 * @param {Msg<M, T, D>} msg The message from which to extract the trace.
 * @returns A new domain trace.
 */
export const dtFromMsg = <M extends MsgType, T extends string, D>(msg: Msg<M, T, D>): DomainTrace => {
    return { correlationid: msg.correlationid, causationid: msg.id };
};

/**
 * Function signature for creating a parsed message.
 * @template M The type of message ('cmd' or 'evt').
 * @template T The type of command or event.
 * @template D The payload data.
 */
type ParsedNewMesg = <M extends MsgType, T extends string, D>(
    fn: NewMsg
) => (msgType: M) => (cleanDT: ((dt: DomainTrace) => DomainTrace)) => (parseMsg: SafeParse<Msg<M, T, D>>) => 
    (type: T) => (domaintrace: DomainTrace) => (data: D) => Result<Msg<M, T, D>, SafeParseFails>;

/**
 * Creates a new parsed message by applying validation.
 * @template M The type of message ('cmd' or 'evt').
 * @template T The type of command or event.
 * @template D The payload data.
 * @param {NewMsg} fn The function to generate a new message.
 * @param {M} msgType The message type ('cmd' or 'evt').
 * @param {typeof cleanDT} _cleanDT The function to clean the domain trace.
 * @param {SafeParse<Msg<M, T, D>>} parseMsg The function to parse and validate the message.
 * @returns A parsed message result.
 */
const parsedNewMsg: ParsedNewMesg = <M extends MsgType, T extends string, D>(
    fn: NewMsg
) => (msgType: M) => (_cleanDT: typeof cleanDT) => (parseMsg: SafeParse<Msg<M, T, D>>) => 
    (type: T) => (domaintrace: DomainTrace) => (data: D) => {
        const dt: DomainTrace = _cleanDT(domaintrace);
        const msg: Msg<M, T, D> = fn<M, T, D>(msgType)(type)(dt)(data);
        return parseMsg(msg);
    };

/**
 * Function signature for creating a new command message.
 * @template T The type of command.
 * @template D The payload data.
 */
type NewCmd = <T extends string, D>(
    parseCmd: SafeParse<CMD<T, D>>
) => (type: T) => (domaintrace: DomainTrace) => (data: D) => Result<CMD<T, D>, SafeParseFails>;

/**
 * Creates a new command message with validation.
 * @template T The type of command.
 * @template D The payload data.
 * @param {SafeParse<CMD<T, D>>} parseCmd The function to validate the command.
 * @returns A validated command message.
 */
export const newCmd: NewCmd = <T extends string, D>(
    parseCmd: SafeParse<CMD<T, D>>
) => (type: T) => (domaintrace: DomainTrace) => (data: D) => {
    return parsedNewMsg<"cmd", T, D>(newMsg)("cmd")(cleanDT)(parseCmd)(type)(domaintrace)(data);
};

/**
 * Function signature for creating a new event message.
 * @template T The type of event.
 * @template D The payload data.
 */
type NewEvt = <T extends string, D>(
    parseEvt: SafeParse<EVT<T, D>>
) => (type: T) => (domaintrace: DomainTrace) => (data: D) => Result<EVT<T, D>, SafeParseFails>;

/**
 * Creates a new event message with validation.
 * @template T The type of event.
 * @template D The payload data.
 * @param {SafeParse<EVT<T, D>>} parseEvt The function to validate the event.
 * @returns A validated event message.
 */
export const newEvt: NewEvt = <T extends string, D>(
    parseEvt: SafeParse<EVT<T, D>>
) => (type: T) => (domaintrace: DomainTrace) => (data: D) => {
    return parsedNewMsg<"evt", T, D>(newMsg)("evt")(cleanDT)(parseEvt)(type)(domaintrace)(data);
};
