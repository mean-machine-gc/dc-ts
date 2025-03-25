type MsgType = "cmd" | "evt";

type Msg<M extends MsgType, T extends string, D> = {
    id: string;
    msgType: M;
    type: T;
    timestamp: number;
    correlationid: string;
    causationid: string | undefined;
    data: D;
};

export type CMD<T extends string, D> = Msg<"cmd", T, D>;

export type EVT<T extends string, D> = Msg<"evt", T, D>;

export type DomainTrace = {
    correlationid: string | undefined;
    causationid: string | undefined;
};


export type CoreWf<C, S, E> = {
    cmd: C;
    state: S;
    evt: E;
};

export type CorePy<E, S, C> = {
    cmd: C;
    state: S;
    evt: E;
};