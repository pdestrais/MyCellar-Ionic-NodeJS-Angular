import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';

import { LoginComponent } from './login.component';

const routes: Routes = [
	{
		path: '',
		component: LoginComponent
	}
];

@NgModule({
	declarations: [ LoginComponent ],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		IonicModule,
		RouterModule.forChild(routes),
		TranslateModule
	]
})
export class LoginModule {}
