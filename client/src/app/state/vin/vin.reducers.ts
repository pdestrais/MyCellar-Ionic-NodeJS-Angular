import { createReducer, on } from "@ngrx/store";
import * as VinAction from "./vin.actions";
import { VinModel } from "../../models/cellar.model";

export interface VinState {
  // vins is a Map with vin._id as as key and vin as value
  vins: Map<string, VinModel>;
  error: string | null;
  status:
    | "pending"
    | "loading"
    | "error"
    | "success save"
    | "success delete"
    | "success";
  wineInstance: VinModel;
  source: string;
}

export const initialState: VinState = {
  vins: new Map(),
  error: null,
  status: null,
  wineInstance: null,
  source: "",
};

export const vinReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the wines
  on(VinAction.loadVins, (state) => {
    return { ...state, status: "loading" };
  }),
  // Handle successfully loaded wines
  on(VinAction.loadVinsSuccess, (state, { vins }) => ({
    ...state,
    vins: new Map(vins.map((obj: VinModel) => [obj._id, obj])),
    error: null,
    status: "success",
  })),
  // Handle wines load failure
  on(VinAction.loadVinsFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is added
  on(VinAction.createVin, (state, { vin }) => {
    return { ...state, status: "pending" };
  }),
  // Add the new wine to the wines array
  on(VinAction.createVinSuccess, (state, { vin, source }) => {
    var newMap = new Map(state.vins);
    newMap.set(vin._id, vin);
    return {
      ...state,
      status: "success save",
      error: "null",
      vins: newMap,
      source: source,
      wineInstance: vin,
    };
  }),
  // handle wine save failure
  on(VinAction.createVinFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is deleted
  on(VinAction.deleteVin, (state, { vin }) => ({
    ...state,
    status: "pending",
  })),
  // add created wine to wines state
  on(VinAction.deleteVinSuccess, (state, { result, source }) => {
    var newMap = new Map(state.vins);
    newMap.delete(result.id);
    //newMap[result.id] = undefined;
    return {
      ...state,
      status: "success delete",
      error: "null",
      vins: newMap,
      wineInstance: new VinModel({ _id: result.id, _rev: result.rev }),
      source: source,
    };
  }),
  // handle wine save failure
  on(VinAction.createVinFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  }))
);
