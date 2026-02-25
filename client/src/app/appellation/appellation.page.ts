import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit, effect, signal, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
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
import { AppellationStore } from "../services/appellation-state.store";
import { VinStore } from "../services/vin-state.store";

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
    // ============================================
    // DEPENDENCIES (Inject)
    // ============================================
    private readonly route = inject(ActivatedRoute);
    private readonly navCtrl = inject(NavController);
    private readonly formBuilder = inject(FormBuilder);
    private readonly translate = inject(TranslateService);
    private readonly alertController = inject(AlertController);
    private readonly toastCtrl = inject(ToastController);
    private readonly appellationStore = inject(AppellationStore);
    private readonly vinStore = inject(VinStore);

    // ============================================
    // COMPONENT STATE (Signals)
    // ============================================
    // Current appellation being edited - as a signal
    readonly currentAppellation = signal<AppellationModel>(new AppellationModel({
        _id: "",
        courte: "",
        longue: "",
    }));

    // Get appellations list from AppellationStore
    readonly appellations = this.appellationStore.appellationsList;
    
    // Get duplicate map from AppellationStore
    readonly appellationsMap = this.appellationStore.appellationMapForDuplicates;

    public submitted = signal<boolean>(false);
    public appellationForm!: FormGroup;
    public list = signal<boolean>(true);
    public showWines = signal<boolean>(false);

    // Route parameter as signal
    private readonly routeParams = toSignal(this.route.params);
    readonly appellationId = computed(() => this.routeParams()?.["id"] || null);

    constructor() {
        addIcons({ caretForwardOutline });

        // Effect: Load selected appellation when appellationId changes
        effect(() => {
            const id = this.appellationId();
            debug("[Effect:appellationId] Appellation ID changed:", id);

            if (id) {
                // Get appellation from store
                const appellationSignal = this.appellationStore.getAppellationById(id);
                const appellation = appellationSignal();
                
                if (appellation) {
                    this.list.set(false);
                    this.currentAppellation.set(appellation);
                    this.appellationForm.get("courte")!.setValue(appellation.courte);
                    this.appellationForm.get("longue")!.setValue(appellation.longue);
                    debug("[Effect:appellationId] Appellation loaded:", JSON.stringify(appellation));
                }
            } else {
                // No appellation selected, creating new appellation
                this.currentAppellation.set(new AppellationModel({
                    _id: "",
                    courte: "",
                    longue: "",
                }));
            }
        }, { allowSignalWrites: true });
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
        this.submitted.set(false);
        
        // Set list mode based on route data
        this.route.snapshot.data["action"] == "list"
            ? this.list.set(true)
            : this.list.set(false);
    }

    private noDouble(group: FormGroup) {
        debug("[noDouble] called");
        if (
            !group.controls["courte"] ||
            !group.controls["longue"] ||
            !group.controls["courte"].dirty ||
            !group.controls["longue"].dirty
        )
            return null;
        
        const appellationsMap = this.appellationsMap();
        if (
            appellationsMap &&
            appellationsMap.has(group.value.courte + group.value.longue)
        ) {
            debug("[noDouble]double detected");
            return { double: true };
        } else return null;
    }

    public editAppellation(appellation: AppellationModel | null) {
        if (appellation && appellation._id)
            this.navCtrl.navigateForward(["/appellation", appellation._id]);
        else this.navCtrl.navigateForward(["/appellation"]);
    }

    public async saveAppellation() {
        debug("[saveAppellation] Entering");
        this.submitted.set(true);
        
        if (this.appellationForm.valid) {
            debug("[saveAppellation] Appellation valid");
            const currentAppellation = this.currentAppellation();
            const updatedAppellation = {
                ...currentAppellation,
                ...this.appellationForm.value,
            };
            
            try {
                await this.appellationStore.saveAppellation(updatedAppellation);
                this.presentToast(
                    this.translate.instant("general.dataSaved"),
                    "success",
                    "home",
                    2000
                );
            } catch (error) {
                debug("[saveAppellation] Error:", error);
                this.presentToast(
                    this.translate.instant("general.DBError"),
                    "error",
                    null,
                    5000
                );
            }
        } else {
            debug("[saveAppellation] Appellation invalid");
            this.presentToast(
                this.translate.instant("general.invalidData"),
                "error",
                null
            );
        }
    }

    public async deleteAppellation() {
        // Check if appellation is used by any wines
        const currentAppellation = this.currentAppellation();
        const winesByAppellationSignal = this.vinStore.getWinesByAppellation(currentAppellation._id);
        const wineList = winesByAppellationSignal();
        const used = wineList.length > 0;
        
        if (!used) {
            const alert = await this.alertController.create({
                header: this.translate.instant("general.confirm"),
                message: this.translate.instant("general.sure"),
                buttons: [
                    {
                        text: this.translate.instant("general.cancel"),
                    },
                    {
                        text: this.translate.instant("general.ok"),
                        handler: async () => {
                            try {
                                await this.appellationStore.deleteAppellation(currentAppellation);
                                this.presentToast(
                                    this.translate.instant("wine.wineDeleted"),
                                    "success",
                                    "home",
                                    2000
                                );
                            } catch (error) {
                                debug("[deleteAppellation] Error:", error);
                                this.presentToast(
                                    this.translate.instant("general.DBError"),
                                    "error",
                                    null,
                                    5000
                                );
                            }
                        },
                    },
                ],
            });
            await alert.present();
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

// Made with Bob
