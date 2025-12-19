import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ReadyToDrinkPage } from './ready-to-drink.page';
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonList, IonIcon, IonBadge } from "@ionic/angular/standalone";

const routes: Routes = [
    {
        path: '',
        component: ReadyToDrinkPage
    }
];

@NgModule({
    imports: [ReadyToDrinkPage, CommonModule, FormsModule, TranslateModule, RouterModule.forChild(routes), IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonAccordionGroup, IonAccordion, IonItem, IonLabel, IonList, IonIcon, IonBadge]
})
export class ReadyToDrinkPageModule { }
