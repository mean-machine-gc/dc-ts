
Worklow definitions:

ts`
    export type WasteWfFails = CoreWfFails | 
    WeightWasteWfFails | 
    'invalid_command_type' | 
    'invalid_command_type' | 
    'not_implemented' |
    'waste_must_be_weighted_before_being_stored' |
    'waste_is_already_stored' |
    'invalid_waste_state_for_this_action' |
    'invalid_waste_state' |
    'invalid_waste_toxicity_level' |
    'invalid_location_type_in_cmd' |
    'b3_waste_must_be_stored_in_hazardous_location' |
    'b3_waste_must_be_stored_in_cold_storage'

    export type NewWasteWf = CoreWf<NewWasteCmd, {}, WasteCreatedEvt, WasteWfFails>
    export type WeightWasteWf = CoreWf<WeightWasteCmd, Waste, WasteWeightedEvt, WeightWasteWfFails>
    export type WeightWasteWfFails = CoreWfFails | 'weighting_waste_not_allowed'
    export type StoreWasteWf = CoreWf<StoreWasteCmd, Waste, WasteStoredEvt>
    export type PendingApprovalWf = CoreWf<PendingApprovalCmd, Waste, WastePendingApprovalEvt>
    export type ReadyForShippingWf = CoreWf<ReadyForShippingCmd, Waste, WasteReadyForShippingEvt>
    export type ShipWasteWf = CoreWf<ShipWasteCmd, Waste, WasteShippedEvt>

    export type WasteWf = NewWasteWf | WeightWasteWf | StoreWasteWf | PendingApprovalWf | ReadyForShippingWf | ShipWasteWf
`

Command handler:

ts`
    import { acceptRes, fail, Result, SafeParse, SafeParseFails, splitRes, trySuccess } from "dc-ts";
import { Waste, WasteEvent } from "./__schema__";
import { WasteCmd } from "../commands/commands";
import { WasteWf, WasteWfFails } from "../workflows/workflows";
import { newWasteWf } from "./new-waste-wf";
import { weightWasteWf } from "./weight-waste-wf";

const _wasteWf = (cmd: WasteCmd) => (currState: Waste) => {
    switch(cmd.type){
        case 'new-waste':
            return newWasteWf(cmd)(currState)
        case 'weight-waste':
            return weightWasteWf(cmd)(currState)
        case 'store-waste':
            return fail<WasteWfFails>('not_implemented')
        case 'set-pending-approval':
            return fail<WasteWfFails>('not_implemented')
        case 'set-ready-for-shipping':
            return fail<WasteWfFails>('not_implemented')
        case 'ship-waste':
            return fail<WasteWfFails>('not_implemented')
        default:
            const _exhaustiveCheck: never = cmd;
            return fail('invalid_command_type')
    }
}

    type PartialWf<S, T, F extends string> = (currState: S) => Result<T, F>
    type PartialWasteWf = PartialWf<Waste, WasteEvent, WasteWfFails>
    type WasteWfRes = Result<WasteEvent, WasteWfFails>
    const cmdHandler =
        (parseCmd: SafeParse<WasteCmd>) => 
        (parseState: SafeParse<Waste>) => 
        (wf: WasteWf) => 
        (cmd: WasteCmd) => 
        (currState: Waste) => {
        const parseCmdRes = parseCmd(cmd)
        const partialWfRes = acceptRes<WasteWf, WasteCmd, SafeParseFails, PartialWasteWf>(wf)(parseCmdRes)
        const parseStateRes = parseState(currState)
        const wfRes = acceptRes<PartialWasteWf, Waste, SafeParseFails, WasteWfRes>(trySuccess<PartialWasteWf, SafeParseFails>(partialWfRes))(parseStateRes) 
        return splitRes(wfRes)
    }
`