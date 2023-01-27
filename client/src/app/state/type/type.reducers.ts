import { createReducer, on } from "@ngrx/store";
import * as TypeAction from "./type.actions";
import { TypeModel } from "../../models/cellar.model";
import dayjs, { Dayjs } from "dayjs";
import Debug from "debug";
import { IEventLog } from "../app.state";

const debug = Debug("app:state:typereducer");

export interface TypeState {
  // types is a Map with type._id as as key and type as value
  types: Map<string, TypeModel>;
  error: string | null;
  status:
    | "pending"
    | "loading"
    | "error"
    | "saved"
    | "deleted"
    | "loaded"
    | "noop";
  eventLog: IEventLog[];
  source: string;
  currentType: { id: string; rev: string };
}

export const initialState: TypeState = {
  types: new Map(),
  error: null,
  status: null,
  source: "",
  eventLog: [],
  currentType: undefined,
};

export const typeReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the types
  on(TypeAction.loadTypes, (state) => {
    return { ...state, status: "loading" };
  }),
  // Handle successfully loaded types
  on(TypeAction.loadTypesSuccess, (state, { types }) => {
    debug("[loadTypesSuccess]");
    return {
      ...state,
      types:
        types && Array.isArray(types)
          ? new Map(types.map((obj: TypeModel) => [obj._id, obj]))
          : new Map(),
      error: null,
      status: "loaded",
    };
  }),
  // Handle types load failure
  on(TypeAction.loadTypesFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while type is added
  on(TypeAction.editType, (state, { id, rev }) => {
    return { ...state, currentType: { id: id, rev: rev } };
  }),
  // Set pending while type is added
  on(TypeAction.createType, (state, { type }) => {
    return { ...state, status: "pending" };
  }),
  // Add the new type to the types array
  on(TypeAction.createTypeSuccess, (state, { _type, source }) => {
    debug(
      "[createTypeSuccess] ts: " +
        window.performance.now() +
        "\n  source: " +
        source +
        "\n  type: " +
        JSON.stringify(_type)
    );
    var newTypeMap = new Map(state.types);
    var newEventArray = Array.from(state.eventLog);
    newTypeMap.set(_type._id, _type);
    newEventArray.push({
      id: _type._id ? _type._id : _type.id,
      rev: _type._rev ? _type._rev : _type.rev,
      action: "create",
      timestamp: dayjs(),
    });
    // if the type the action is refereing to is not in the eventLog, this is the first type creation event and it should affect the state
    // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
    if (source == "external") {
      debug(
        "[createTypeSuccess] ts: " +
          window.performance.now() +
          "\n  external source"
      );
      return {
        ...state,
        status: "saved",
        error: "null",
        types: newTypeMap,
        source: source,
        eventLog: newEventArray,
      };
    } else {
      debug(
        "[createTypeSuccess] ts: " +
          window.performance.now() +
          "\n  internal source"
      );
      return {
        ...state,
        status: "saved",
        error: "null",
        types: newTypeMap,
        source: source,
        eventLog: newEventArray,
        currentType: { id: _type._id, rev: _type._rev },
      };
    }
  }),
  // handle type save failure
  on(TypeAction.createTypeFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while type is deleted
  on(TypeAction.deleteType, (state, { type }) => ({
    ...state,
    status: "pending",
  })),
  // add created type to types state
  on(TypeAction.deleteTypeSuccess, (state, { result, source }) => {
    debug(
      "[TypeReducer]deleteTypeSuccess ts: " +
        window.performance.now() +
        "\n  source: " +
        source +
        "\n  result: " +
        JSON.stringify(result)
    );
    // if the type the action is refereing to is not in the eventLog, this is the first type creation event and it should affect the state
    // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
    var newTypeMap = new Map(state.types);
    var newEventArray = Array.from(state.eventLog);
    newTypeMap.delete(result.id);
    newEventArray.push({
      id: result.id ? result.id : result.doc._id,
      rev: result.rev ? result.id : result.doc._rev,
      action: "delete",
      timestamp: dayjs(),
    });

    return {
      ...state,
      status: "deleted",
      error: "null",
      types: newTypeMap,
      source: source,
      eventLog: newEventArray,
    };
  }),
  // handle type save failure
  on(TypeAction.createTypeFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  on(TypeAction.setStatusToLoaded, (state) => ({
    ...state,
    status: "loaded",
  }))
);
