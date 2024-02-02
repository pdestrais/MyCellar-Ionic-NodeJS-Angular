import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { TypePage } from './type.page';
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonList, IonItem, IonIcon, IonButton, IonLabel, IonInput } from "@ionic/angular/standalone";

const routes: Routes = [
    {
        path: '',
        component: TypePage
    }
];

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule,
        RouterModule.forChild(routes),
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
    ],
    declarations: [TypePage]
})
export class TypePageModule { }
