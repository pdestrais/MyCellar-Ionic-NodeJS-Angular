import { Component, computed, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { AlertController, NavController } from "@ionic/angular/standalone";
import { TranslateModule } from "@ngx-translate/core";
import { VinModel } from "../models/cellar.model";
import { VinStore } from "../services/vin-state.store";
import { TypeStore } from "../services/type-state.store";
import { OrigineStore } from "../services/origine-state.store";
import { AppellationStore } from "../services/appellation-state.store";
import { addIcons } from "ionicons";
import { arrowBackOutline, searchOutline } from "ionicons/icons";
import {
  IonRouterLink, IonHeader, IonToolbar, IonButtons, IonMenuButton,
  IonTitle, IonContent, IonButton, IonIcon, IonList, IonItem,
  IonBadge, IonSearchbar, IonSpinner, IonToggle, IonLabel
} from "@ionic/angular/standalone";
import Debug from "debug";

const debug = Debug("app:home");

@Component({
  selector: "app-home",
  templateUrl: "home.page.html",
  styleUrls: ["home.page.scss"],
  standalone: true,
  imports: [
    CommonModule, RouterModule, TranslateModule, IonRouterLink, 
    IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, 
    IonContent, IonButton, IonIcon, IonList, IonItem, IonBadge, 
    IonSearchbar, IonSpinner, IonToggle, IonLabel
  ],
})
export class HomePage implements OnInit {
  // Inject dependencies
  private readonly vinStore = inject(VinStore);
  private readonly typeStore = inject(TypeStore);
  private readonly origineStore = inject(OrigineStore);
  private readonly appellationStore = inject(AppellationStore);
  private readonly alertCtrl = inject(AlertController);
  private readonly navCtrl = inject(NavController);
  
  // ============================================
  // LOCAL UI STATE (Component-specific signals)
  // ============================================
  
  // Search and filter state
  readonly searchString = signal<string>("");
  readonly isInStock = signal<boolean>(true);
  readonly dashboardSelectedMaturity = signal<string>("");
  
  // ============================================
  // COMPUTED STATE FROM VINSTORE
  // ============================================
  
  // Loading state from VinStore
  readonly loading = this.vinStore.isLoading;
  
  // Filtered wines based on search
  readonly filteredWines = computed<VinModel[]>(() =>
    this.vinStore.getFilteredWines(
      this.searchString(), 
      this.isInStock()
    )()
  );
  
  // Wines by maturity category
  readonly maturityWinesList = computed<VinModel[]>(() => {
    const category = this.dashboardSelectedMaturity();
    if (category === "") {
      return [];
    }
    return this.vinStore.getWinesByMaturity(category)();
  });
  
  // Maturity counts for dashboard
  readonly maturityCounts = this.vinStore.maturityCounts;
  
  // Individual counts (for template compatibility)
  readonly nbrARTD = computed(() => this.maturityCounts().ARTD);
  readonly nbrRTD = computed(() => this.maturityCounts().RTD);
  readonly nbrNRTD = computed(() => this.maturityCounts().NRTD);
  readonly nbrNotRTD = computed(() => this.maturityCounts().NotRTD);
  
  constructor() {
    addIcons({ arrowBackOutline, searchOutline });
  }
  
  async alertNoRemoteDB() {
    const alert = await this.alertCtrl.create({
      header: "Alert",
      subHeader: "No Cloudant DB defined",
      message:
        "No Cloudant remote DB is defined to store your notes. Only the local storage will be used and no synchronization between devices will be possible.",
      buttons: [
        {
          text: "Ok",
          handler: () => {
            window.localStorage.setItem("localUse", "true");
            console.log("Confirm Ok");
          },
        },
        {
          text: "Configure Cloudant DB",
          handler: () => {
            this.navCtrl.navigateForward("/preferences");
            console.log("Confirm Cancel");
          },
        },
      ],
    });
    
    await alert.present();
  }
  
  ngOnInit() {
    debug("[ngOnInit] entering method");
    
    // Load vins via VinStore
    this.vinStore.loadVins();
    
    // Load reference data from signal stores
    // Note: TypeStore, OrigineStore, and AppellationStore auto-load in their onInit hooks
    // No explicit loading needed here as they initialize on injection
    
    // Check for remote DB configuration
    const result = window.localStorage.getItem("myCellar.remoteDBURL");
    if (!result || !result.startsWith("http")) {
      debug("[ngOnInit] no remote db initialized, using local database");
      if (!window.localStorage.getItem("localUse")) {
        this.alertNoRemoteDB();
      }
    }
  }
  
  cancelSearch() {
    this.searchString.set("");
  }
  
  goToVin(params: string) {
    if (!params) params = "";
    this.navCtrl.navigateForward("/vin/" + params);
  }
}

// Made with Bob
