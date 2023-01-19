import { createReducer, on } from "@ngrx/store";
import * as OrigineAction from "./origine.actions";
import { OrigineModel } from "../../models/cellar.model";

export interface OrigineState {
  // origines is a Map with origine._id as as key and origine as value
  origines: Map<string, OrigineModel>;
  error: string | null;
  status:
    | "pending"
    | "loading"
    | "error"
    | "success save"
    | "success delete"
    | "success";
  source: string;
}

export const initialState: OrigineState = {
  origines: new Map(),
  error: null,
  status: null,
  source: "",
};

export const origineReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the wines
  on(OrigineAction.loadOrigines, (state) => {
    return { ...state, status: "loading" };
  }),
  // Handle successfully loaded wines
  on(OrigineAction.loadOriginesSuccess, (state, { origines }) => ({
    ...state,
    origines: new Map(origines.map((obj: OrigineModel) => [obj._id, obj])),
    error: null,
    status: "success",
  })),
  // Handle wines load failure
  on(OrigineAction.loadOriginesFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is added
  on(OrigineAction.createOrigine, (state, { origine }) => {
    return { ...state, status: "pending" };
  }),
  // Add the new wine to the wines array
  on(OrigineAction.createOrigineSuccess, (state, { origine, source }) => {
    var newMap = new Map(state.origines);
    newMap.set(origine._id, origine);
    return {
      ...state,
      status: "success save",
      error: "null",
      origines: newMap,
      source: source,
      wineInstance: origine,
    };
  }),
  // handle wine save failure
  on(OrigineAction.createOrigineFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is deleted
  on(OrigineAction.deleteOrigine, (state, { origine }) => ({
    ...state,
    status: "pending",
  })),
  // add created wine to wines state
  on(OrigineAction.deleteOrigineSuccess, (state, { result, source }) => {
    var newMap = new Map(state.origines);
    newMap.delete(result.id);
    //newMap[result.id] = undefined;
    return {
      ...state,
      status: "success delete",
      error: "null",
      origines: newMap,
      wineInstance: new OrigineModel({ _id: result.id, _rev: result.rev }),
      source: source,
    };
  }),
  // handle wine save failure
  on(OrigineAction.createOrigineFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  }))
);
