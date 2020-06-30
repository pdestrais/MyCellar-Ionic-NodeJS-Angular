import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';

import { VinPage, ModalPage } from './vin.page';
import { ViewerComponent } from './viewer/viewer.component';

const routes: Routes = [
	{
		path: '',
		component: VinPage
	}
];

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		IonicModule,
		RouterModule.forChild(routes),
		TranslateModule
	],
	providers: [],
	entryComponents: [ ModalPage, ViewerComponent ],
	declarations: [ VinPage, ModalPage, ViewerComponent ]
})
export class VinPageModule {}
