import { createReducer, on } from "@ngrx/store";
import * as OrigineAction from "./origine.actions";
import { OrigineModel } from "../../models/cellar.model";
import dayjs, { Dayjs } from "dayjs";
import Debug from "debug";
import { IEventLog } from "../app.state";

const debug = Debug("app:state:originereducer");

export interface OrigineState {
  // origines is a Map with origine._id as as key and origine as value
  origines: Map<string, OrigineModel>;
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
  currentOrigine: { id: string; rev: string };
}

export const initialState: OrigineState = {
  origines: new Map(),
  error: null,
  status: null,
  source: "",
  eventLog: [],
  currentOrigine: undefined,
};

export const origineReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the origines
  on(OrigineAction.loadOrigines, (state) => {
    return { ...state, status: "loading" } as OrigineState;
  }),
  // Handle successfully loaded origines
  on(OrigineAction.loadOriginesSuccess, (state, { origines }) => {
    debug("[loadOriginesSuccess]");
    return {
      ...state,
      origines:
        origines && Array.isArray(origines)
          ? new Map(origines.map((obj: OrigineModel) => [obj._id, obj]))
          : new Map(),
      error: null,
      status: "loaded",
    } as OrigineState;
  }),
  // Handle origines load failure
  on(
    OrigineAction.loadOriginesFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as OrigineState)
  ),
  // Set pending while origine is added
  on(OrigineAction.editOrigine, (state, { id, rev }) => {
    return { ...state, currentOrigine: { id: id, rev: rev } } as OrigineState;
  }),
  // Set pending while origine is added
  on(OrigineAction.createOrigine, (state, { origine }) => {
    return { ...state, status: "pending" } as OrigineState;
  }),
  // Add the new origine to the origines array
  on(OrigineAction.createOrigineSuccess, (state, { origine, source }) => {
    debug(
      "[createOrigineSuccess] ts: " +
        window.performance.now() +
        "\n  source: " +
        source +
        "\n  origine: " +
        JSON.stringify(origine)
    );
    var newOrigineMap = new Map(state.origines);
    var newEventArray = Array.from(state.eventLog);
    newOrigineMap.set(origine._id, origine);
    newEventArray.push({
      id: origine._id ? origine._id : origine.id,
      rev: origine._rev ? origine._rev : origine.rev,
      action: "create",
      timestamp: dayjs(),
    });
    // if the origine the action is refereing to is not in the eventLog, this is the first origine creation event and it should affect the state
    // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
    if (source == "external") {
      debug(
        "[createOrigineSuccess] ts: " +
          window.performance.now() +
          "\n  external source"
      );
      return {
        ...state,
        status: "saved",
        error: "null",
        origines: newOrigineMap,
        source: source,
        eventLog: newEventArray,
      } as OrigineState;
    } else {
      debug(
        "[createOrigineSuccess] ts: " +
          window.performance.now() +
          "\n  internal source"
      );
      return {
        ...state,
        status: "saved",
        error: "null",
        origines: newOrigineMap,
        source: source,
        eventLog: newEventArray,
        currentOrigine: { id: origine._id, rev: origine._rev },
      } as OrigineState;
    }
  }),
  // handle origine save failure
  on(
    OrigineAction.createOrigineFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as OrigineState)
  ),
  // Set pending while origine is deleted
  on(
    OrigineAction.deleteOrigine,
    (state, { origine }) =>
      ({
        ...state,
        status: "pending",
      } as OrigineState)
  ),
  // add created origine to origines state
  on(OrigineAction.deleteOrigineSuccess, (state, { result, source }) => {
    debug(
      "[OrigineReducer]deleteOrigineSuccess ts: " +
        window.performance.now() +
        "\n  source: " +
        source +
        "\n  result: " +
        JSON.stringify(result)
    );
    // if the origine the action is refereing to is not in the eventLog, this is the first origine creation event and it should affect the state
    // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
    var newOrigineMap = new Map(state.origines);
    var newEventArray = Array.from(state.eventLog);
    newOrigineMap.delete(result.id);
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
      origines: newOrigineMap,
      source: source,
      eventLog: newEventArray,
    } as OrigineState;
  }),
  // handle origine save failure
  on(
    OrigineAction.createOrigineFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as OrigineState)
  ),
  on(
    OrigineAction.setStatusToLoaded,
    (state) =>
      ({
        ...state,
        status: "loaded",
      } as OrigineState)
  )
);
