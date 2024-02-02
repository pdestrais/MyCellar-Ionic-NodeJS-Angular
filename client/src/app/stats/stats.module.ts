import { TranslateModule } from '@ngx-translate/core';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { StatsPage } from './stats.page';
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonItem, IonLabel, IonSelect, IonSelectOption, IonButton } from "@ionic/angular/standalone";

const routes: Routes = [
    {
        path: '',
        component: StatsPage
    }
];

@NgModule({
    imports: [CommonModule, FormsModule, TranslateModule, RouterModule.forChild(routes), IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonItem, IonLabel, IonSelect, IonSelectOption, IonButton],
    declarations: [StatsPage]
})
export class StatsPageModule { }
