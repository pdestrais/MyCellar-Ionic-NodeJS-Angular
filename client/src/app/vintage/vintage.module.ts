import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Routes, RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";
import { VintageComponent } from "./vintage.component";
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonListHeader, IonLabel, IonItem, IonSelect, IonSelectOption } from "@ionic/angular/standalone";

const routes: Routes = [
    {
        path: "",
        component: VintageComponent,
    },
];

@NgModule({
    imports: [VintageComponent, CommonModule, RouterModule.forChild(routes), TranslateModule, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonListHeader, IonLabel, IonItem, IonSelect, IonSelectOption],
})
export class VintageModule { }
