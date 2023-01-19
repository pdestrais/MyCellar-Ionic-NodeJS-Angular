import { ActionReducerMap } from "@ngrx/store";
import { VinState, vinReducer } from "./vin/vin.reducers";
import { TypeState, typeReducer } from "./type/type.reducers";
import { OrigineState, origineReducer } from "./origine/origine.reducers";
import {
  AppellationState,
  appellationReducer,
} from "./appellation/appellation.reducers";

export interface AppState {
  vins: VinState;
  types: TypeState;
  origines: OrigineState;
  appellations: AppellationState;
}

export const reducers: ActionReducerMap<AppState> = {
  vins: vinReducer,
  origines: origineReducer,
  types: typeReducer,
  appellations: appellationReducer,
};
