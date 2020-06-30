import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { IonicModule } from '@ionic/angular';

import { TypePage } from './type.page';

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
		IonicModule,
		TranslateModule,
		RouterModule.forChild(routes)
	],
	declarations: [ TypePage ]
})
export class TypePageModule {}
