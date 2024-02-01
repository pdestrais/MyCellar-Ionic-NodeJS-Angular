import { createReducer, on } from "@ngrx/store";
import * as VinAction from "./vin.actions";
import { VinModel } from "../../models/cellar.model";
import dayjs, { Dayjs } from "dayjs";
import Debug from "debug";
import { IEventLog } from "../app.state";

const debug = Debug("app:state:winereducer");

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
    | "noop"
    | null;
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
  currentWine: { id: "", rev: "" },
};

export const vinReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the wines
  on(VinAction.loadVins, (state) => {
    return { ...state, status: "loading" } as VinState;
  }),
  // Handle successfully loaded wines
  on(VinAction.loadVinsSuccess, (state, { vins }) => {
    debug("[loadVinsSuccess]");
    return {
      ...state,
      vins:
        vins && Array.isArray(vins)
          ? new Map(vins.map((obj: VinModel) => [obj._id, obj]))
          : new Map(),
      error: null,
      status: "loaded",
    } as VinState;
  }),
  // Handle wines load failure
  on(
    VinAction.loadVinsFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as VinState)
  ),
  // Set pending while wine is added
  on(VinAction.editVin, (state, { id, rev }) => {
    return { ...state, currentWine: { id: id, rev: rev } };
  }),
  // Set pending while wine is added
  on(VinAction.createVin, (state, { vin }) => {
    return { ...state, status: "pending" } as VinState;
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
      } as VinState;
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
      } as VinState;
    }
  }),
  // handle wine save failure
  on(
    VinAction.createVinFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as VinState)
  ),
  // Set pending while wine is deleted
  on(
    VinAction.deleteVin,
    (state, { vin }) =>
      ({
        ...state,
        status: "pending",
      } as VinState)
  ),
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
    } as VinState;
  }),
  // handle wine save failure
  on(
    VinAction.createVinFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as VinState)
  ),
  on(
    VinAction.setStatusToLoaded,
    (state) =>
      ({
        ...state,
        status: "loaded",
      } as VinState)
  )
);
