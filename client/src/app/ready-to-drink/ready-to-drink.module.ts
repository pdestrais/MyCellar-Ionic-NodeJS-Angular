import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { IonicModule } from '@ionic/angular';

import { ReadyToDrinkPage } from './ready-to-drink.page';

const routes: Routes = [
	{
		path: '',
		component: ReadyToDrinkPage
	}
];

@NgModule({
	imports: [ CommonModule, FormsModule, IonicModule, TranslateModule, RouterModule.forChild(routes) ],
	declarations: [ ReadyToDrinkPage ]
})
export class ReadyToDrinkPageModule {}
