import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { ProfileComponent } from './profile/profile.component';
import { ResetpwdComponent } from './resetpwd/resetpwd.component';
import { ChangepwdComponent } from './changepwd/changepwd.component';
import { AuthGuard } from '../guards/auth.guard';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'profile',
		pathMatch: 'full'
	},
	{
		path: 'profile',
		component: ProfileComponent,
		canActivate: [ AuthGuard ]
	},
	{ path: 'resetpwd', component: ResetpwdComponent },
	{
		path: 'changepwd',
		component: ChangepwdComponent,
		canActivate: [ AuthGuard ]
	}
];

@NgModule({
	declarations: [ ProfileComponent, ResetpwdComponent, ChangepwdComponent ],
	imports: [
		CommonModule,
		FormsModule,
		ReactiveFormsModule,
		IonicModule,
		TranslateModule,
		RouterModule.forChild(routes)
	]
})
export class UserManagementModule {}
