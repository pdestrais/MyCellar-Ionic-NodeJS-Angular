import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Routes, RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { VinPage, ModalPage } from "./vin.page";
import { ViewerComponent } from "./viewer/viewer.component";
import { NgxStarRatingComponent } from "../ngx-star-rating/ngx-star-rating.component";
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonMenuButton,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonGrid,
  IonRow,
  IonCol,
  IonButton,
  IonIcon,
  IonCardContent,
  IonBadge,
  IonCardHeader,
  IonCard,
} from "@ionic/angular/standalone";

const routes: Routes = [
  {
    path: "",
    component: VinPage,
  },
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonGrid,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
    IonButton,
    IonBadge,
    IonCardContent,
    IonCardHeader,
    IonCard,
  ],
  providers: [],
  declarations: [VinPage, ModalPage, ViewerComponent, NgxStarRatingComponent],
})
export class VinPageModule {}
