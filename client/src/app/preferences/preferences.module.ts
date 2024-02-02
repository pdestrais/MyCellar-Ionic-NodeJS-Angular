import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Routes, RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";

import { PreferencesPage /*, SupportPage*/ } from "./preferences.page";
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItemGroup, IonItemDivider, IonLabel, IonItem, IonSelect, IonSelectOption } from "@ionic/angular/standalone";

const routes: Routes = [
    {
        path: "",
        component: PreferencesPage,
    },
];

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        TranslateModule,
        RouterModule.forChild(routes),
        IonHeader,
        IonToolbar,
        IonButtons,
        IonMenuButton,
        IonTitle,
        IonContent,
        IonGrid,
        IonRow,
        IonCol,
        IonItemGroup,
        IonItemDivider,
        IonLabel,
        IonItem,
        IonSelect,
        IonSelectOption
    ],
    declarations: [PreferencesPage /*, SupportPage */],
})
export class PreferencesPageModule { }
