import { createReducer, on } from "@ngrx/store";
import * as AppellationAction from "./appellation.actions";
import { AppellationModel } from "../../models/cellar.model";

export interface AppellationState {
  // appellations is a Map with appellation._id as as key and appellation as value
  appellations: Map<string, AppellationModel>;
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

export const initialState: AppellationState = {
  appellations: new Map(),
  error: null,
  status: null,
  source: "",
};

export const appellationReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the wines
  on(AppellationAction.loadAppellations, (state) => {
    return { ...state, status: "loading" };
  }),
  // Handle successfully loaded wines
  on(AppellationAction.loadAppellationsSuccess, (state, { appellations }) => ({
    ...state,
    appellations: new Map(
      appellations.map((obj: AppellationModel) => [obj._id, obj])
    ),
    error: null,
    status: "success",
  })),
  // Handle wines load failure
  on(AppellationAction.loadAppellationsFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is added
  on(AppellationAction.createAppellation, (state, { appellation }) => {
    return { ...state, status: "pending" };
  }),
  // Add the new wine to the wines array
  on(
    AppellationAction.createAppellationSuccess,
    (state, { appellation, source }) => {
      var newMap = new Map(state.appellations);
      newMap.set(appellation._id, appellation);
      return {
        ...state,
        status: "success save",
        error: "null",
        appellations: newMap,
        source: source,
      };
    }
  ),
  // handle wine save failure
  on(AppellationAction.createAppellationFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is deleted
  on(AppellationAction.deleteAppellation, (state, { appellation }) => ({
    ...state,
    status: "pending",
  })),
  // add created wine to wines state
  on(
    AppellationAction.deleteAppellationSuccess,
    (state, { result, source }) => {
      var newMap = new Map(state.appellations);
      newMap.delete(result.id);
      //newMap[result.id] = undefined;
      return {
        ...state,
        status: "success delete",
        error: "null",
        appellations: newMap,
        source: source,
      };
    }
  ),
  // handle wine save failure
  on(AppellationAction.createAppellationFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  }))
);
