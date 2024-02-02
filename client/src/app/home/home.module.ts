import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { TranslateModule } from "@ngx-translate/core";

import { HomePage } from "./home.page";
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonButton, IonIcon, IonList, IonItem, IonBadge, IonSearchbar, IonSpinner, IonLabel, IonToggle } from "@ionic/angular/standalone";

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        RouterModule.forChild([
            {
                path: "",
                component: HomePage,
            },
        ]),
        TranslateModule,
        IonHeader,
        IonToolbar,
        IonButtons,
        IonMenuButton,
        IonTitle,
        IonContent,
        IonButton,
        IonIcon,
        IonList,
        IonItem,
        IonBadge,
        IonSearchbar,
        IonSpinner,
        IonLabel,
        IonToggle
    ],
    declarations: [HomePage],
})
export class HomePageModule { }
