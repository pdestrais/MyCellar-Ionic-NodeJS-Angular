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
      exhaustMap(() =>
        // Call the getTypes method, convert it to an observable
        this.pouchService.getDocsOfType$("type").pipe(
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
          // Convert Promise to Observable using from()
          return from(
            this.pouchService.saveDoc(Object.assign({}, action._type), "type") as Promise<IResult>
          ).pipe(
            map((result: IResult) => {
              debug("[saveType$] Save result:", result);
              return TypeAction.createTypeSuccess({
                _type: {
                  ...action._type,
                  _id: result.id,
                  _rev: result.rev,
                },
                source: "internal",
              });
            }),
            catchError((error) => {
              debug("[saveType$] Save error:", error);
              return of(TypeAction.createTypeFailure({ error }));
            })
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
          of(this.pouchService.deleteDoc(action._type)).pipe(
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
        // Filter to only process type documents
        tap((change) =>
          debug(
            "[handleChanges Effect]ts: " +
              window.performance.now() +
              "\n - change : " +
              JSON.stringify(change) +
              "\n - doc._id: " +
              change.doc?._id
          )
        ),
        // Only process changes for type documents (those with _id starting with "type|")
        map((change) => {
          // Check if this is a type document
          if (change.doc && change.doc._id && change.doc._id.startsWith("type|")) {
            if (!change.deleted) {
              return TypeAction.createTypeSuccess({
                _type: change.doc,
                source: "external",
              });
            } else {
              return TypeAction.deleteTypeSuccess({
                result: change,
                source: "external",
              });
            }
          }
          // Return a no-op action for non-type documents
          return TypeAction.setStatusToLoaded();
        })
      ),
    { dispatch: true }
  );
}
