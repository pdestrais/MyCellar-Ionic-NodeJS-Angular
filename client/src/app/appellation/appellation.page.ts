import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit } from "@angular/core";
import { NavController, AlertController, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { AppellationModel, VinModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";

import Debugger from "debug";
import { Store } from "@ngrx/store";
import * as AppellationSelectors from "../state/appellation/appellation.selectors";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as AppellationActions from "../state/appellation/appellation.actions";
import { Observable, Subject } from "rxjs";
import { takeUntil, tap } from "rxjs/operators";
import { AppState } from "../state/app.state";

import { replacer } from "../util/util";
import { addIcons } from "ionicons";
import { caretForwardOutline } from "ionicons/icons";

const debug = Debugger("app:appellation");

@Component({
    selector: "app-appellation",
    templateUrl: "./appellation.page.html",
    styleUrls: ["./appellation.page.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        TranslateModule,
        RouterModule,
        IonHeader,
        IonToolbar,
        IonButtons,
        IonMenuButton,
        IonTitle,
        IonContent,
        IonList,
        IonItem,
        IonIcon,
        IonButton,
        IonLabel,
        IonInput
    ]
})
export class AppellationPage implements OnInit {
    public appellation: AppellationModel = new AppellationModel({
        _id: "",
        courte: "",
        longue: "",
    });
    public appellations$!: Observable<AppellationModel[]>;
    private unsubscribe$ = new Subject<void>();
    public winesForAppellation$!: Observable<VinModel[]>;

    public appellationList: Array<AppellationModel> = [];
    public appellationsMap: Map<any, any> = new Map<any, any>();
    public submitted: boolean = false;
    public appellationForm!: FormGroup;
    public list: boolean = true;
    public showWines: boolean = false;

    constructor(
        private route: ActivatedRoute,
        private navCtrl: NavController,
        private formBuilder: FormBuilder,
        private translate: TranslateService,
        private alertController: AlertController,
        private toastCtrl: ToastController,
        private store: Store<AppState>
    ) {
        addIcons({ caretForwardOutline });
        addIcons({ caretForwardOutline });
    }

    public ngOnInit() {
        debug("[ngOnInit]called");
        // form initialization
        this.appellationForm = this.formBuilder.group(
            {
                courte: ["", Validators.required],
                longue: ["", Validators.required],
            },
            { validator: this.noDouble.bind(this) }
        );
        this.submitted = false;
        this.route.snapshot.data["action"] == "list"
            ? (this.list = true)
            : (this.list = false);
        // We need to load the appellation list even if we create or modify an appellation because in this case we need the appellation list to check for doubles
        this.appellations$ = this.store
            .select(AppellationSelectors.getAllAppellationsArraySorted)
            .pipe(takeUntil(this.unsubscribe$));
        // loading appellations map from state (used for double check)
        this.store
            .select(AppellationSelectors.appellationMapForDuplicates)
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((appellationsMap) => (this.appellationsMap = appellationsMap));
        // Now loading selected wine from the state
        // if id param is there, the appellation will be loaded, if not, we want to create a new appellation and the form values will remain as initialized
        this.store
            .select(
                AppellationSelectors.getAppellation(
                    this.route.snapshot.paramMap.get("id")!
                )
            )
            .pipe(takeUntil(this.unsubscribe$))
            .subscribe((appellation) => {
                if (appellation) {
                    this.list = false;
                    this.appellation = appellation;
                    // We have selected an appellation
                    // reset VinState status to avoid shadow UI messages coming from previous updates on other app instances
                    this.store.dispatch(
                        AppellationActions.editAppellation({
                            id: appellation._id,
                            rev: appellation._rev,
                        })
                    );
                    this.appellationForm.get("courte")!.setValue(appellation.courte);
                    this.appellationForm.get("longue")!.setValue(appellation.longue);
                    debug(
                        "[Vin.ngOnInit]Appellation loaded : " + JSON.stringify(appellation)
                    );
                } else {
                    // No wine was selected, when will register a new appellation
                    this.store.dispatch(
                        AppellationActions.editAppellation({ id: "", rev: "" })
                    );
                }
            });

        this.winesForAppellation$ = this.store
            .select(VinSelectors.getWinesByAppellation(this.appellation._id))
            .pipe(takeUntil(this.unsubscribe$));

        // Handling state changes (originating from save, update or delete operations in the UI but also coming for synchronization with data from other application instances)
        this.store
            .select((state: AppState) => state.appellations)
            .pipe(
                takeUntil(this.unsubscribe$)
                /*         tap((appellationState) =>
                  debug(
                    "[ngOnInit]handle appellationState Changes - ts " +
                      window.performance.now() +
                      "\nappellationState : " +
                      JSON.stringify(appellationState, replacer)
                  )
                )
         */
            )
            .subscribe((appellationState) => {
                switch (appellationState.status) {
                    case "saved":
                        debug(
                            "[ngOnInit] handling change to 'saved' status - ts " +
                            window.performance.now() +
                            "\nappellationState : " +
                            JSON.stringify(appellationState, replacer)
                        );

                        // if we get an event that a wine is saved. We need to check it's id and
                        // if the event source is internal (saved within this instance of the application) or external.
                        // - (I) internal ? => (wine is saved in the application) a confirmation message is shown to the user and the app goes to the home scree
                        // - (II) external ?
                        //       - (A) event comes from the local DB resulting from the update of the wine we just saved
                        //       - (B) event comes from the remoteDB resulting from the update of a wine ( not the one we are working on or having been working on)
                        //       - (C) event coming from the remoteDB resulting from the update of the wine we are working on. (concurrent updata)
                        if (appellationState.source == "internal") {
                            debug("[ngInit](I) Standard wine saved");
                            // Internal event
                            this.presentToast(
                                this.translate.instant("general.dataSaved"),
                                "success",
                                "home",
                                2000
                            );
                            this.store.dispatch(AppellationActions.setStatusToLoaded());
                        } else {
                            // let's try to find a duplicate event in the eventLog
                            let filteredEventLog = appellationState.eventLog.filter(
                                (value) =>
                                    value.id == appellationState.currentAppellation!.id &&
                                    value.rev == appellationState.currentAppellation!.rev &&
                                    value.action == "create"
                            );
                            debug(
                                "[ngInit](II) FilteredEventLog : " +
                                JSON.stringify(filteredEventLog)
                            );
                            if (filteredEventLog.length == 2) {
                                debug(
                                    "[ngInit](II.A) Duplicate state change for the same wine"
                                );
                                this.store.dispatch(AppellationActions.setStatusToLoaded());
                            } else if (
                                appellationState.eventLog[appellationState.eventLog.length - 1]
                                    .id == appellationState.currentAppellation!.id &&
                                appellationState.eventLog[appellationState.eventLog.length - 1]
                                    .rev == appellationState.currentAppellation!.rev &&
                                appellationState.eventLog[appellationState.eventLog.length - 1]
                                    .action == "create" &&
                                this.appellationForm.dirty // otherwize, there is no way to make the distinction when you open a brand new editing form for a wine that has been created in another application instance
                            ) {
                                // Event showing concurrent editing on the same wine that was saved somewhere else
                                debug("[ngInit](II.C) Concurrent editing on the same wine");
                                this.presentToast(
                                    this.translate.instant(
                                        "wine.savedConcurrentlyOnAnotherInstance"
                                    ),
                                    "warning",
                                    "",
                                    0,
                                    "Close"
                                );
                            } else {
                                debug("[ngInit](II.B) Update of another wine");
                            }
                        }
                        break;
                    case "error":
                        this.presentToast(
                            this.translate.instant("general.DBError") +
                            " " +
                            appellationState.error,
                            "error",
                            null,
                            5000
                        );
                        break;
                    case "deleted":
                        // if we get an event that an appellation is saved. We need to check it's id and
                        // if the event source is internal (saved within this instance of the application) or external.
                        // - (I) internal ? => (appellation is saved in the application) a confirmation message is shown to the user and the app goes to the home scree
                        // - (II) external ?
                        //       - (A) event comes from the local DB resulting from the update of the wine we just saved
                        //       - (B) event comes from the remoteDB resulting from the update of a wine ( not the one we are working on or having been working on)
                        //       - (C) event coming from the remoteDB resulting from the update of the wine we are working on. (concurrent updata)
                        // Delete does not suppress a doc or it's revision. It just creates a new document (with a new revision) that has the "_delete" attribute set to true
                        if (appellationState.source == "internal") {
                            debug("[ngInit](I) Standard wine deleted");
                            // Internal event
                            this.presentToast(
                                this.translate.instant("wine.wineDeleted"),
                                "success",
                                "home",
                                2000
                            );
                            this.store.dispatch(AppellationActions.setStatusToLoaded());
                        } else {
                            // let's try to find a duplicate event in the eventLog
                            // this should never happen for a delete
                            if (
                                appellationState.eventLog.filter(
                                    (value) =>
                                        value.id == appellationState.currentAppellation!.id &&
                                        value.rev >= appellationState.currentAppellation!.rev &&
                                        value.action == "delete"
                                ).length == 2
                            ) {
                                debug(
                                    "[ngInit](II.A) Duplicate state change for the same wine"
                                );
                                this.store.dispatch(AppellationActions.setStatusToLoaded());
                            } else if (
                                appellationState.eventLog[appellationState.eventLog.length - 1]
                                    .id == appellationState.currentAppellation!.id &&
                                appellationState.eventLog[appellationState.eventLog.length - 1]
                                    .action == "delete"
                            ) {
                                // Event showing concurrent editing on the same wine that was saved somewhere else
                                debug("[ngInit](II.C) Concurrent editing on the same wine");
                                this.presentToast(
                                    this.translate.instant(
                                        "wine.deletedConcurrentlyOnAnotherInstance"
                                    ),
                                    "warning",
                                    "home",
                                    0,
                                    "Close"
                                );
                            } else {
                                debug("[ngInit](II.B) Delete of another wine");
                            }
                        }
                        break;
                }
            });
    }

    public ngOnDestroy() {
        debug("[Appellation.ngOnDestroy]called");
        // Unscubribe all observers
        this.unsubscribe$.next();
        this.unsubscribe$.complete();
    }

    private noDouble(group: FormGroup) {
        debug("[noDouble] called");
        if (
            !group.controls["courte"] ||
            !group.controls["longue"] ||
            !group.controls["courte"].dirty ||
            !group.controls["courte"].dirty
        )
            return null;
        /*     if (!group.controls.courte.dirty || !group.controls.courte.dirty)
          return null;
     */
        if (
            this.appellationsMap &&
            this.appellationsMap.has(group.value.courte + group.value.longue)
        ) {
            debug("[noDouble]double detected");
            return { double: true };
        } else return null;
    }

    public editAppellation(appellation) {
        if (appellation._id)
            this.navCtrl.navigateForward(["/appellation", appellation._id]);
        else this.navCtrl.navigateForward(["/appellation"]);
    }

    public saveAppellation() {
        debug("[saveAppellation]entering");
        this.submitted = true;
        if (this.appellationForm.valid) {
            // validation succeeded
            debug("[AppellationVin]Appellation valid");
            // when the vin has been loaded from the store, it is immutable, we need to deep copy it before being able to update its properties
            let mutableAppellation = JSON.parse(JSON.stringify(this.appellation));
            // now combine the loaded wine data with the new form data
            this.appellation = {
                ...mutableAppellation,
                ...this.appellationForm.value,
            };

            this.store.dispatch(
                AppellationActions.createAppellation({ appellation: this.appellation })
            );
        } else {
            debug("[Vin - saveVin]vin invalid");
            this.presentToast(
                this.translate.instant("general.invalidData"),
                "error",
                null
            );
        }
    }

    public deleteAppellation() {
        // Before deleting an appellation, we need to check if this appellation is not used for any of the wines.
        // If it is used, it can't be deleted.
        let used = false;
        this.winesForAppellation$.subscribe((wineListForAppellation) =>
            wineListForAppellation.length > 0 ? (used = true) : (used = false)
        );
        if (!used) {
            this.alertController
                .create({
                    header: this.translate.instant("general.confirm"),
                    message: this.translate.instant("general.sure"),
                    buttons: [
                        {
                            text: this.translate.instant("general.cancel"),
                        },
                        {
                            text: this.translate.instant("general.ok"),
                            handler: () => {
                                this.store.dispatch(
                                    AppellationActions.deleteAppellation({
                                        appellation: this.appellation,
                                    })
                                );
                            },
                        },
                    ],
                })
                .then((alert) => {
                    alert.present();
                });
        } else {
            this.presentToast(
                this.translate.instant("appellation.cantDeleteBecauseUsed"),
                "error",
                null
            );
        }
    }

    async presentToast(
        message: string,
        type: string,
        nextPageUrl: string | null,
        duration?: number,
        closeButtonText?: string
    ) {
        if (duration && duration != 0) {
            const toast = await this.toastCtrl.create({
                color:
                    type == "success"
                        ? "secondary"
                        : type == "warning"
                            ? "warning"
                            : "danger",
                message: message,
                duration: duration ? duration : 2000,
            });
            toast.present();
            if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
        } else {
            const toast = await this.toastCtrl.create({
                color:
                    type == "success"
                        ? "secondary"
                        : type == "warning"
                            ? "warning"
                            : "danger",
                message: message,
                buttons: [
                    {
                        text: closeButtonText,
                        role: "cancel",
                        handler: () => {
                            if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
                        },
                    },
                ],
            });
            toast.present();
        }
    }
}
