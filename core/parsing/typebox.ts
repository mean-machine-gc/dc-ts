import { Type, TAnySchema, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { fail, Result, succeed } from '../result'
import { SafeParse } from './safeparse'

export type SafeParseTBox = <T>(schema: TAnySchema) => SafeParse<T>

export const safeParseTBox: SafeParseTBox = 
    (schema: TAnySchema) => 
    <T>(data: T) => {
        try{
            Value.Assert(schema, data)
            return succeed(data)
        }catch(e){
            return fail('parse_error', e)
        }
    }