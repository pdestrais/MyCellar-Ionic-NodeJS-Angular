import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import * as OrigineAction from "./origine.actions";
import { PouchdbService } from "../../services/pouchdb.service";
import { of, from, pipe } from "rxjs";
import { switchMap, map, catchError, exhaustMap, tap } from "rxjs/operators";
import { Store } from "@ngrx/store";
//import { selectAllOrigines } from "./Origine.selectors";
import { OrigineModel } from "../../models/cellar.model";

import { AppState } from "../app.state";

@Injectable()
export class OrigineEffects {
  //  private lastSavedWine: OrigineModel = null;

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private pouchService: PouchdbService
  ) {}

  // Run this code when a loadOrigines action is dispatched
  loadOrigines$ = createEffect(() =>
    this.actions$.pipe(
      tap((action) => {
        /* console.log("[loadOrigine$]action : " + action) */
      }),
      ofType(OrigineAction.loadOrigines),
      switchMap(() => {
        // Call the getOrigines method, convert it to an observable
        return from(this.pouchService.getDocsOfType("origine")).pipe(
          // Take the returned value and return a new success action containing the Origines
          map((origines: OrigineModel[]) =>
            OrigineAction.loadOriginesSuccess({ origines: origines })
          ),
          // Or... if it errors return a new failure action containing the error
          catchError((error) =>
            of(OrigineAction.loadOriginesFailure({ error }))
          )
        );
      })
    )
  );

  // Run this code when the createOrigine action is dispatched
  saveOrigine$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OrigineAction.createOrigine),
        switchMap((action) => {
          //        this.lastSavedWine = action.origine;
          return from(
            this.pouchService.saveDoc(
              Object.assign({}, action.origine),
              "origine"
            )
          ).pipe(
            map((origine: OrigineModel) => {
              return OrigineAction.createOrigineSuccess({
                origine: { ...action.origine, _id: origine.id },
                source: "internal",
              });
            }),
            catchError((error) =>
              of(OrigineAction.createOrigineFailure({ error }))
            )
          );
        })
        /*        exhaustMap((action) =>
          from(
            this.pouchService.saveDoc(Object.assign({}, action.origine), "origine")
          ).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((origine: OrigineModel) => {
              console.log("[saveOrigine$ Effect]" + JSON.stringify(origine));
              OrigineAction.createOrigineSuccess({ origine: origine });
            }),
            // Or... if it errors return a new failure action containing the error
            catchError((error) => of(OrigineAction.createOrigineFailure({ error })))
          )
        )
*/
      ),

    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );

  // Run this code when the deleteOrigine action is dispatched
  removeOrigine$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OrigineAction.deleteOrigine),
        exhaustMap((action) =>
          from(this.pouchService.deleteDoc(action.origine)).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((deleteResult) =>
              OrigineAction.deleteOrigineSuccess({
                result: deleteResult,
                source: "internal",
              })
            ),
            // Or... if it errors return a new failure action containing the error
            catchError((error) =>
              of(OrigineAction.deleteOrigineFailure({ error }))
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
        tap((change) => console.log("[Effect]" + change)),
        map((change) => {
          if (!change.deleted) {
            //this.lastSavedWine = null;
            return OrigineAction.createOrigineSuccess({
              origine: change.doc,
              source: "external",
            });
          } else
            return OrigineAction.deleteOrigineSuccess({
              result: change,
              source: "external",
            });
        })
      ),
    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );
}
