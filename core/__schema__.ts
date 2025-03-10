import { Type, Static, TSchema } from '@sinclair/typebox'

type Msg<M extends TSchema, T extends TSchema, D extends TSchema> = Static<
  ReturnType<typeof Msg<M, T, D>>
>
const Msg = <M extends TSchema, T extends TSchema, D extends TSchema>(
  M: M,
  T: T,
  D: D
) =>
  Type.Object({
    id: Type.String(),
    msgType: M,
    type: T,
    timestamp: Type.Number(),
    correlationid: Type.String(),
    causationid: Type.Union([Type.String(), Type.Undefined()]),
    data: D
  })

export type CMD<T extends TSchema, D extends TSchema> = Static<
  ReturnType<typeof CMD<T, D>>
>
export const CMD = <T extends TSchema, D extends TSchema>(T: T, D: D) =>
  Msg(Type.Literal('cmd'), T, D)

export type EVT<T extends TSchema, D extends TSchema> = Static<
  ReturnType<typeof EVT<T, D>>
>
export const EVT = <T extends TSchema, D extends TSchema>(T: T, D: D) =>
  Msg(Type.Literal('evt'), T, D)