import { createReducer, on } from "@ngrx/store";
import * as AppellationAction from "./appellation.actions";
import { AppellationModel } from "../../models/cellar.model";
import dayjs, { Dayjs } from "dayjs";
import Debug from "debug";
import { IEventLog } from "../app.state";

const debug = Debug("app:state:appellationreducer");

export interface AppellationState {
  // appellations is a Map with appellation._id as as key and appellation as value
  appellations: Map<string, AppellationModel>;
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
  currentAppellation: { id: string; rev: string };
}

export const initialState: AppellationState = {
  appellations: new Map(),
  error: null,
  status: null,
  source: "",
  eventLog: [],
  currentAppellation: undefined,
};

export const appellationReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the appellations
  on(AppellationAction.loadAppellations, (state) => {
    return { ...state, status: "loading" } as AppellationState;
  }),
  // Handle successfully loaded appellations
  on(AppellationAction.loadAppellationsSuccess, (state, { appellations }) => {
    debug("[loadAppellationsSuccess]");
    return {
      ...state,
      appellations:
        appellations && Array.isArray(appellations)
          ? new Map(appellations.map((obj: AppellationModel) => [obj._id, obj]))
          : new Map(),
      error: null,
      status: "loaded",
    } as AppellationState;
  }),
  // Handle appellations load failure
  on(
    AppellationAction.loadAppellationsFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as AppellationState)
  ),
  // Set pending while appellation is added
  on(AppellationAction.editAppellation, (state, { id, rev }) => {
    return {
      ...state,
      currentAppellation: { id: id, rev: rev },
    } as AppellationState;
  }),
  // Set pending while appellation is added
  on(AppellationAction.createAppellation, (state, { appellation }) => {
    return { ...state, status: "pending" } as AppellationState;
  }),
  // Add the new appellation to the appellations array
  on(
    AppellationAction.createAppellationSuccess,
    (state, { appellation, source }) => {
      debug(
        "[createAppellationSuccess] ts: " +
          window.performance.now() +
          "\n  source: " +
          source +
          "\n  appellation: " +
          JSON.stringify(appellation)
      );
      var newAppellationMap = new Map(state.appellations);
      var newEventArray = Array.from(state.eventLog);
      newAppellationMap.set(appellation._id, appellation);
      newEventArray.push({
        id: appellation._id ? appellation._id : appellation.id,
        rev: appellation._rev ? appellation._rev : appellation.rev,
        action: "create",
        timestamp: dayjs(),
      });
      // if the appellation the action is refereing to is not in the eventLog, this is the first appellation creation event and it should affect the state
      // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
      if (source == "external") {
        debug(
          "[createAppellationSuccess] ts: " +
            window.performance.now() +
            "\n  external source"
        );
        return {
          ...state,
          status: "saved",
          error: "null",
          appellations: newAppellationMap,
          source: source,
          eventLog: newEventArray,
        } as AppellationState;
      } else {
        debug(
          "[createAppellationSuccess] ts: " +
            window.performance.now() +
            "\n  internal source"
        );
        return {
          ...state,
          status: "saved",
          error: "null",
          appellations: newAppellationMap,
          source: source,
          eventLog: newEventArray,
          currentAppellation: { id: appellation._id, rev: appellation._rev },
        } as AppellationState;
      }
    }
  ),
  // handle appellation save failure
  on(
    AppellationAction.createAppellationFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as AppellationState)
  ),
  // Set pending while appellation is deleted
  on(
    AppellationAction.deleteAppellation,
    (state, { appellation }) =>
      ({
        ...state,
        status: "pending",
      } as AppellationState)
  ),
  // add created appellation to appellations state
  on(
    AppellationAction.deleteAppellationSuccess,
    (state, { result, source }) => {
      debug(
        "[AppellationReducer]deleteAppellationSuccess ts: " +
          window.performance.now() +
          "\n  source: " +
          source +
          "\n  result: " +
          JSON.stringify(result)
      );
      // if the appellation the action is refereing to is not in the eventLog, this is the first appellation creation event and it should affect the state
      // if not, this is a duplicate (for example resulting from a change originating from the remote DB after an update on the local db) and the state is not affected
      var newAppellationMap = new Map(state.appellations);
      var newEventArray = Array.from(state.eventLog);
      newAppellationMap.delete(result.id);
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
        appellations: newAppellationMap,
        source: source,
        eventLog: newEventArray,
      } as AppellationState;
    }
  ),
  // handle appellation save failure
  on(
    AppellationAction.createAppellationFailure,
    (state, { error }) =>
      ({
        ...state,
        error: error,
        status: "error",
      } as AppellationState)
  ),
  on(
    AppellationAction.setStatusToLoaded,
    (state) =>
      ({
        ...state,
        status: "loaded",
      } as AppellationState)
  )
);
