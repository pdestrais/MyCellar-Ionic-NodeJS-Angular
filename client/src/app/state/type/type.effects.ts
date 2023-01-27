import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import * as TypeAction from "./type.actions";
import { PouchdbService } from "../../services/pouchdb.service";
import { of, from, pipe } from "rxjs";
import { switchMap, map, catchError, exhaustMap, tap } from "rxjs/operators";
import { Store } from "@ngrx/store";
import { TypeModel } from "../../models/cellar.model";

import { AppState } from "../app.state";

import Debug from "debug";

const debug = Debug("app:state:typeeffect");

export interface IResult {
  ok?: boolean;
  id: string;
  rev: string;
}
@Injectable()
export class TypeEffects {
  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private pouchService: PouchdbService
  ) {}

  // Run this code when a loadTypes action is dispatched
  loadTypes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TypeAction.loadTypes),
      switchMap(() =>
        // Call the getTypes method, convert it to an observable
        from(this.pouchService.getDocsOfType("type")).pipe(
          // Take the returned value and return a new success action containing the Types
          map((types: TypeModel[]) =>
            TypeAction.loadTypesSuccess({
              types: types,
            })
          ),
          // Or... if it errors return a new failure action containing the error
          catchError((error) => of(TypeAction.loadTypesFailure({ error })))
        )
      )
    )
  );

  // Run this code when the createType action is dispatched
  saveType$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(TypeAction.createType),
        switchMap((action) => {
          //        this.lastSavedWine = action.type;
          return from(
            this.pouchService.saveDoc(Object.assign({}, action._type), "type")
          ).pipe(
            map((result: IResult) => {
              return TypeAction.createTypeSuccess({
                _type: {
                  ...action._type,
                  _id: result.id,
                  _rev: result.rev,
                },
                source: "internal",
              });
            }),
            catchError((error) => of(TypeAction.createTypeFailure({ error })))
          );
        })
        /*        exhaustMap((action) =>
          from(
            this.pouchService.saveDoc(Object.assign({}, action.type), "type")
          ).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((type: TypeModel) => {
              console.log("[saveType$ Effect]" + JSON.stringify(type));
              TypeAction.createTypeSuccess({ type: type });
            }),
            // Or... if it errors return a new failure action containing the error
            catchError((error) => of(TypeAction.createTypeFailure({ error })))
          )
        )
*/
      ),

    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );

  // Run this code when the deleteType action is dispatched
  removeType$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(TypeAction.deleteType),
        exhaustMap((action) =>
          from(this.pouchService.deleteDoc(action._type)).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((deleteResult: IResult) =>
              TypeAction.deleteTypeSuccess({
                result: deleteResult,
                source: "internal",
              })
            ),
            // Or... if it errors return a new failure action containing the error
            catchError((error) => of(TypeAction.deleteTypeFailure({ error })))
          )
        )
      ),
    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );

  // This code is executed when a change is detected on the local PouchDB instance (resulting from a replication with the remote couchDB)
  handleChanges$ = createEffect(
    () =>
      this.pouchService.dbChanges$.pipe(
        tap((change) =>
          debug(
            "[handleChanges Effect]ts: " +
              window.performance.now() +
              "\n - change : " +
              JSON.stringify(change)
          )
        ),
        map((change) => {
          if (!change.deleted) {
            return TypeAction.createTypeSuccess({
              _type: change.doc,
              source: "external",
            });
          } else
            return TypeAction.deleteTypeSuccess({
              result: change,
              source: "external",
            });
        })
      ),
    { dispatch: true }
  );
}
