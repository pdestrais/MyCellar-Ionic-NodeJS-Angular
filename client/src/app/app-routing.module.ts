import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
	{
		path: '',
		redirectTo: 'home',
		pathMatch: 'full'
	},
	{
		path: 'home',
		loadChildren: './home/home.module#HomePageModule',
		canActivate: [ AuthGuard ]
	},
	{
		path: 'preferences',
		loadChildren: './preferences/preferences.module#PreferencesPageModule',
		canActivate: [ AuthGuard ]
	},
	{
		path: 'vin',
		loadChildren: './vin/vin.module#VinPageModule',
		canActivate: [ AuthGuard ]
	},
	{
		path: 'vin/:id',
		loadChildren: './vin/vin.module#VinPageModule',
		canActivate: [ AuthGuard ]
	},
	{
		path: 'appellations',
		loadChildren: './appellation/appellation.module#AppellationPageModule',
		data: { action: 'list' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'appellation',
		loadChildren: './appellation/appellation.module#AppellationPageModule',
		data: { action: 'edit' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'appellation/:id',
		loadChildren: './appellation/appellation.module#AppellationPageModule',
		data: { action: 'edit' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'type',
		loadChildren: './type/type.module#TypePageModule',
		data: { action: 'edit' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'types',
		loadChildren: './type/type.module#TypePageModule',
		data: { action: 'list' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'type/:id',
		loadChildren: './type/type.module#TypePageModule',
		data: { action: 'edit' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'region',
		loadChildren: './region/region.module#RegionPageModule',
		data: { action: 'edit' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'region/:id',
		loadChildren: './region/region.module#RegionPageModule',
		data: { action: 'edit' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'regions',
		loadChildren: './region/region.module#RegionPageModule',
		data: { action: 'list' },
		canActivate: [ AuthGuard ]
	},
	{
		path: 'stats',
		loadChildren: './stats/stats.module#StatsPageModule',
		canActivate: [ AuthGuard ]
	},
	{
		path: 'readytodrink',
		loadChildren: './ready-to-drink/ready-to-drink.module#ReadyToDrinkPageModule',
		canActivate: [ AuthGuard ]
	},
	{ path: 'about', loadChildren: './about/about.module#AboutPageModule' },
	{
		path: 'rapport',
		loadChildren: './rapport/rapport.module#RapportPageModule',
		canActivate: [ AuthGuard ]
	},
	{ path: 'login', loadChildren: () => import('./authentication/login/login.module').then((m) => m.LoginModule) },
	{ path: 'register', loadChildren: './authentication/register/register.module#RegisterModule' },
	{
		path: 'user-management',
		loadChildren: () => import('./user-management/user-management.module').then((m) => m.UserManagementModule)
	}
];

@NgModule({
	imports: [ RouterModule.forRoot(routes /* , {
			enableTracing: true
		} */) ],
	exports: [ RouterModule ]
})
export class AppRoutingModule {}
