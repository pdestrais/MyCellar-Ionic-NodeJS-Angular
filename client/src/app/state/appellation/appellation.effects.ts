import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import * as AppellationAction from "./appellation.actions";
import { PouchdbService } from "../../services/pouchdb.service";
import { of, from, pipe } from "rxjs";
import { switchMap, map, catchError, exhaustMap, tap } from "rxjs/operators";
import { Store } from "@ngrx/store";
import { AppellationModel } from "../../models/cellar.model";

import { AppState } from "../app.state";

import Debug from "debug";

const debug = Debug("app:state:appellationeffect");

export interface IResult {
  ok?: boolean;
  id: string;
  rev: string;
}
@Injectable()
export class AppellationEffects {
  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private pouchService: PouchdbService
  ) {}

  // Run this code when a loadAppellations action is dispatched
  loadAppellations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppellationAction.loadAppellations),
      exhaustMap(() =>
        // Call the getAppellations method, convert it to an observable
        this.pouchService.getDocsOfType$("appellation").pipe(
          // Take the returned value and return a new success action containing the Appellations
          map((appellations: AppellationModel[]) =>
            AppellationAction.loadAppellationsSuccess({
              appellations: appellations,
            })
          ),
          // Or... if it errors return a new failure action containing the error
          catchError((error) =>
            of(AppellationAction.loadAppellationsFailure({ error }))
          )
        )
      )
    )
  );

  // Run this code when the createAppellation action is dispatched
  saveAppellation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppellationAction.createAppellation),
        switchMap((action) => {
          // Convert Promise to Observable using from()
          return from(
            this.pouchService.saveDoc(
              Object.assign({}, action.appellation),
              "appellation"
            ) as Promise<IResult>
          ).pipe(
            map((result: IResult) => {
              debug("[saveAppellation$] Save result:", result);
              return AppellationAction.createAppellationSuccess({
                appellation: {
                  ...action.appellation,
                  _id: result.id,
                  _rev: result.rev,
                },
                source: "internal",
              });
            }),
            catchError((error) => {
              debug("[saveAppellation$] Save error:", error);
              return of(AppellationAction.createAppellationFailure({ error }));
            })
          );
        })
        /*        exhaustMap((action) =>
          from(
            this.pouchService.saveDoc(Object.assign({}, action.appellation), "appellation")
          ).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((appellation: AppellationModel) => {
              console.log("[saveAppellation$ Effect]" + JSON.stringify(appellation));
              AppellationAction.createAppellationSuccess({ appellation: appellation });
            }),
            // Or... if it errors return a new failure action containing the error
            catchError((error) => of(AppellationAction.createAppellationFailure({ error })))
          )
        )
*/
      ),

    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );

  // Run this code when the deleteAppellation action is dispatched
  removeAppellation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppellationAction.deleteAppellation),
        exhaustMap((action) =>
          of(this.pouchService.deleteDoc(action.appellation)).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((deleteResult: IResult) =>
              AppellationAction.deleteAppellationSuccess({
                result: deleteResult,
                source: "internal",
              })
            ),
            // Or... if it errors return a new failure action containing the error
            catchError((error) =>
              of(AppellationAction.deleteAppellationFailure({ error }))
            )
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
        // Filter to only process appellation documents
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
        // Only process changes for appellation documents (those with _id starting with "appellation|")
        map((change) => {
          // Check if this is an appellation document
          if (change.doc && change.doc._id && change.doc._id.startsWith("appellation|")) {
            if (!change.deleted) {
              return AppellationAction.createAppellationSuccess({
                appellation: change.doc,
                source: "external",
              });
            } else {
              return AppellationAction.deleteAppellationSuccess({
                result: change,
                source: "external",
              });
            }
          }
          // Return a no-op action for non-appellation documents
          return AppellationAction.setStatusToLoaded();
        })
      ),
    { dispatch: true }
  );
}
