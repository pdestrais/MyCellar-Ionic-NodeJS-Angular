import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { Routes, RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { VinPage, ModalPage } from "./vin.page";
import { ViewerComponent } from "./viewer/viewer.component";
import { NgxStarRatingComponent } from "../ngx-star-rating/ngx-star-rating.component";
import { IonicModule } from "@ionic/angular";

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
    IonicModule,
    VinPage,
    ModalPage,
    ViewerComponent,
    NgxStarRatingComponent,
  ],
  providers: [],
  declarations: [],
})
export class VinPageModule { }
