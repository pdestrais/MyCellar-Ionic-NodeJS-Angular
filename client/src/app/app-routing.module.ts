import { NgModule } from "@angular/core";
import { Routes, RouterModule } from "@angular/router";

import { AuthGuard } from "./guards/auth.guard";

const routes: Routes = [
  {
    path: "",
    redirectTo: "home",
    pathMatch: "full",
  },
  {
    path: "home",
    loadChildren: () =>
      import("./home/home.module").then((m) => m.HomePageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "preferences",
    loadChildren: () =>
      import("./preferences/preferences.module").then(
        (m) => m.PreferencesPageModule
      ),
    canActivate: [AuthGuard],
  },
  {
    path: "vin",
    loadChildren: () => import("./vin/vin.module").then((m) => m.VinPageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "vin/:id",
    loadChildren: () => import("./vin/vin.module").then((m) => m.VinPageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "appellations",
    loadChildren: () =>
      import("./appellation/appellation.module").then(
        (m) => m.AppellationPageModule
      ),
    data: { action: "list" },
    canActivate: [AuthGuard],
  },
  {
    path: "appellation",
    loadChildren: () =>
      import("./appellation/appellation.module").then(
        (m) => m.AppellationPageModule
      ),
    data: { action: "edit" },
    canActivate: [AuthGuard],
  },
  {
    path: "appellation/:id",
    loadChildren: () =>
      import("./appellation/appellation.module").then(
        (m) => m.AppellationPageModule
      ),
    data: { action: "edit" },
    canActivate: [AuthGuard],
  },
  {
    path: "type",
    loadChildren: () =>
      import("./type/type.module").then((m) => m.TypePageModule),
    data: { action: "edit" },
    canActivate: [AuthGuard],
  },
  {
    path: "types",
    loadChildren: () =>
      import("./type/type.module").then((m) => m.TypePageModule),
    data: { action: "list" },
    canActivate: [AuthGuard],
  },
  {
    path: "type/:id",
    loadChildren: () =>
      import("./type/type.module").then((m) => m.TypePageModule),
    data: { action: "edit" },
    canActivate: [AuthGuard],
  },
  {
    path: "region",
    loadChildren: () =>
      import("./region/region.module").then((m) => m.RegionPageModule),
    data: { action: "edit" },
    canActivate: [AuthGuard],
  },
  {
    path: "region/:id",
    loadChildren: () =>
      import("./region/region.module").then((m) => m.RegionPageModule),
    data: { action: "edit" },
    canActivate: [AuthGuard],
  },
  {
    path: "regions",
    loadChildren: () =>
      import("./region/region.module").then((m) => m.RegionPageModule),
    data: { action: "list" },
    canActivate: [AuthGuard],
  },
  {
    path: "stats",
    loadChildren: () =>
      import("./stats/stats.module").then((m) => m.StatsPageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "readytodrink",
    loadChildren: () =>
      import("./ready-to-drink/ready-to-drink.module").then(
        (m) => m.ReadyToDrinkPageModule
      ),
    canActivate: [AuthGuard],
  },
  {
    path: "about",
    loadChildren: () =>
      import("./about/about.module").then((m) => m.AboutPageModule),
  },
  {
    path: "rapport",
    loadChildren: () =>
      import("./rapport/rapport.module").then((m) => m.RapportPageModule),
    canActivate: [AuthGuard],
  },
  {
    path: "login",
    loadChildren: () =>
      import("./authentication/login/login.module").then((m) => m.LoginModule),
  },
  {
    path: "register",
    loadChildren: () =>
      import("./authentication/register/register.module").then(
        (m) => m.RegisterModule
      ),
  },
  {
    path: "user-management",
    loadChildren: () =>
      import("./user-management/user-management.module").then(
        (m) => m.UserManagementModule
      ),
  },
  {
    path: "vintage",
    loadChildren: () =>
      import("./vintage/vintage.module").then((m) => m.VintageModule),
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(
      routes /* , {
			enableTracing: true
		} */
    ),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
