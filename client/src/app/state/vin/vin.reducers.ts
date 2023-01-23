import { createReducer, on } from "@ngrx/store";
import * as VinAction from "./vin.actions";
import { VinModel } from "../../models/cellar.model";
import dayjs, { Dayjs } from "dayjs";
import Debug from "debug";

const debug = Debug("app:state:winereducer");

export interface IEventLog {
  id: string;
  rev: string;
  action: string;
  timestamp: Dayjs;
}
export interface VinState {
  // vins is a Map with vin._id as as key and vin as value
  vins: Map<string, VinModel>;
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
  currentWine: { id: string; rev: string };
}

export const initialState: VinState = {
  vins: new Map(),
  error: null,
  status: "noop",
  source: "",
  eventLog: [],
  currentWine: undefined,
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
    status: "loaded",
  })),
  // Handle wines load failure
  on(VinAction.loadVinsFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is added
  on(VinAction.editVin, (state, { id, rev }) => {
    return { ...state, currentWine: { id: id, rev: rev } };
  }),
  // Set pending while wine is added
  on(VinAction.createVin, (state, { vin }) => {
    return { ...state, status: "pending" };
  }),
  // Add the new wine to the wines array
  on(VinAction.createVinSuccess, (state, { vin, source }) => {
    debug(
      "[createVinSuccess] ts: " +
        window.performance.now() +
        "\n  source: " +
        source +
        "\n  vin: " +
        JSON.stringify(vin)
    );
    var newWineMap = new Map(state.vins);
    var newEventArray = Array.from(state.eventLog);
    newWineMap.set(vin._id, vin);
    newEventArray.push({
      id: vin._id ? vin._id : vin.id,
      rev: vin._rev ? vin._rev : vin.rev,
      action: "create",
      timestamp: dayjs(),
    });
    // if the wine the action is refereing to is not in the eventLog, this is the first wine creation event and it should affect the state
    // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
    if (source == "external") {
      debug(
        "[createVinSuccess] ts: " +
          window.performance.now() +
          "\n  external source"
      );
      return {
        ...state,
        status: "saved",
        error: "null",
        vins: newWineMap,
        source: source,
        eventLog: newEventArray,
      };
    } else {
      debug(
        "[createVinSuccess] ts: " +
          window.performance.now() +
          "\n  internal source"
      );
      return {
        ...state,
        status: "saved",
        error: "null",
        vins: newWineMap,
        source: source,
        eventLog: newEventArray,
        currentWine: { id: vin._id, rev: vin._rev },
      };
    }
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
    debug(
      "[VinReducer]deleteVinSuccess ts: " +
        window.performance.now() +
        "\n  source: " +
        source +
        "\n  result: " +
        JSON.stringify(result)
    );
    // if the wine the action is refereing to is not in the eventLog, this is the first wine creation event and it should affect the state
    // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
    var newWineMap = new Map(state.vins);
    var newEventArray = Array.from(state.eventLog);
    newWineMap.delete(result.id);
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
      vins: newWineMap,
      source: source,
      eventLog: newEventArray,
    };
  }),
  // handle wine save failure
  on(VinAction.createVinFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  on(VinAction.setStatusToNoop, (state) => ({
    ...state,
    status: "noop",
  })),
  on(VinAction.setStatusToLoaded, (state) => ({
    ...state,
    status: "loaded",
  }))
);
