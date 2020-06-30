import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';

import { RegisterComponent } from './register.component';

const routes: Routes = [
	{
		path: '',
		component: RegisterComponent
	}
];

@NgModule({
	declarations: [ RegisterComponent ],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		IonicModule,
		RouterModule.forChild(routes),
		TranslateModule
	]
})
export class RegisterModule {}
