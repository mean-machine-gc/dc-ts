import { SafeParse } from "./parsing"
import { isFailure, succeed } from "./result"

export type AGG<T extends string, D> = {
    _tag: T
    data: D
}

type _anyAggregate = AGG<string, any>

const _newAgg = <T extends string, D>(p: SafeParse<AGG<T, D>>) => (_tag: T) => (data: D) => {
    const aggregate = {
        _tag,
        data
    }
    const parseRes = p(aggregate)
    return parseRes
}

export const newAgg = <A extends _anyAggregate>() => {
    return _newAgg<A['_tag'], A['data']>
}

