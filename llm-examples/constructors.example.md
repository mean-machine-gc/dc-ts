Commands definitions:

ts`
    export type NewWasteCmd = CMD<'new-waste', NewWasteData>
    export type WeightWasteCmd = CMD<'weight-waste', WeightWasteData>
    export type StoreWasteCmd = CMD<'store-waste', StoreWasteData>
    export type PendingApprovalCmd = CMD<'set-pending-approval', PendingApprovalData>
    export type ReadyForShippingCmd = CMD<'set-ready-for-shipping', ReadyForShippingData>
    export type ShipWasteCmd = CMD<'ship-waste', ShipWasteData>

    export type WasteCmd = 
        NewWasteCmd | 
        WeightWasteCmd | 
        StoreWasteCmd | 
        PendingApprovalCmd | 
        ReadyForShippingCmd | 
        ShipWasteCmd
`

Commands constructors:
   
ts`
    import { newCmd, newEvt, safeParseTBox } from "dc-ts";
    import { DomainTrace, NewWasteCmd, NewWasteData, PendingApprovalData, ReadyForShippingData, ShipWasteData, StoreWasteData, WasteCmd, WasteCreatedData, WasteEvent, WastePendingApprovalData, WasteReadyForShippingData, WasteStoredData, WasteWasteShippedData, WasteWeightedData, WeightWasteData } from "./__schema__";

    export const newWasteCdm = <T extends WasteCmd['type'], D extends WasteCmd['data']>
        (type: T) => {
            return newCmd<T, D>(safeParseTBox(WasteCmd['data']))(safeParseTBox(WasteCmd))(type)
        }

    export const newNewWasteCmd = newWasteCdm<'new-waste', NewWasteData>('new-waste')
    export const newWeightWasteCmd = newWasteCdm<'weight-waste', WeightWasteData>('weight-waste')
    export const newStoreWasteCmd = newWasteCdm<'store-waste', StoreWasteData>('store-waste')
    export const newPendingApprovalCmd = newWasteCdm<'set-pending-approval', PendingApprovalData>('set-pending-approval')
    export const newReadyForShippingCmd = newWasteCdm<'set-ready-for-shipping', ReadyForShippingData>('set-ready-for-shipping')
    export const newShipWasteCmd = newWasteCdm<'ship-waste', ShipWasteData>('ship-waste')
`

Events definitions:

ts`
    import { EVT } from "dc-ts"
    import { LabelledWaste, PendingApprovalWaste, ReadyForShippingWaste, ShippedWaste, StoredWaste, WeightedWaste } from "../models/waste"

    export type WasteCreatedData = LabelledWaste
    export type WasteCreatedEvt = EVT<'event-created', WasteCreatedData>

    export type WasteWeightedData = WeightedWaste
    export type WasteWeightedEvt = EVT<'waste-weighted', WasteWeightedData>

    export type WasteStoredData = StoredWaste
    export type WasteStoredEvt = EVT<'waste-stored', WasteStoredData>

    export type WastePendingApprovalData = PendingApprovalWaste
    export type WastePendingApprovalEvt = EVT<'waste-pending-approval', WastePendingApprovalData>

    export type WasteReadyForShippingData = ReadyForShippingWaste
    export type WasteReadyForShippingEvt = EVT<'waste-ready-for-shipping', WasteReadyForShippingData>

    export type WasteWasteShippedData = ShippedWaste
    export type WasteShippedEvt = EVT<'waste-shipped', WasteWasteShippedData>

    export type WasteEvent = WasteCreatedEvt | WasteWeightedEvt | WasteStoredEvt | WastePendingApprovalEvt | WasteReadyForShippingEvt | WasteShippedEvt
`

Events constructors:

ts`
    export const newWasteEvt = <T extends WasteEvent['type'], D extends WasteEvent['data']>
    (type: T) => {
        return newEvt<T, D>(safeParseTBox(WasteEvent['data']))(safeParseTBox(WasteEvent))(type)
    }

    export const newWasteCreatedEvt = newWasteEvt<'event-created', WasteCreatedData>('event-created')
    export const newWasteWeightedEvt = newWasteEvt<'waste-weighted', WasteWeightedData>('waste-weighted')
    export const newWasteStoredEvt = newWasteEvt<'waste-stored', WasteStoredData>('waste-stored')
    export const newWastePendingApprovalEvt = newWasteEvt<'waste-pending-approval', WastePendingApprovalData>('waste-pending-approval')
    export const newWasteReadyForShippingEvt = newWasteEvt<'waste-ready-for-shipping', WasteReadyForShippingData>('waste-ready-for-shipping')
    export const newWasteShippedEvt = newWasteEvt<'waste-shipped', WasteWasteShippedData>('waste-shipped')
`
