import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { RouteReuseStrategy } from "@angular/router";

import {
  IonicRouteStrategy,
  provideIonicAngular,
  IonApp,
  IonSplitPane,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRouterOutlet,
  IonBadge,
  IonIcon,
  IonList,
} from "@ionic/angular/standalone";

// import ngx-translate and the http loader
import { TranslateLoader, TranslateModule } from "@ngx-translate/core";
import { TranslateHttpLoader } from "@ngx-translate/http-loader";
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

// AppComponent is standalone; do not declare it here
import { AppRoutingModule } from "./app-routing.module";
import { ServiceWorkerModule } from "@angular/service-worker";
import { environment } from "../environments/environment";
import { StoreModule } from "@ngrx/store";
import { EffectsModule } from "@ngrx/effects";
import { VinEffects } from "./state/vin/vin.effects";
import { vinReducer } from "./state/vin/vin.reducers";
import { OrigineEffects } from "./state/origine/origine.effects";
import { TypeEffects } from "./state/type/type.effects";
import { AppellationEffects } from "./state/appellation/appellation.effects";
import { reducers } from "./state/app.state";

@NgModule({
    imports: [BrowserModule,
        AppRoutingModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: createTranslateLoader,
                deps: [HttpClient],
            },
        }),
        ServiceWorkerModule.register("ngsw-worker.js", {
            enabled: environment.production,
            // Register the ServiceWorker as soon as the app is stable
            // or after 30 seconds (whichever comes first).
            registrationStrategy: "registerWhenStable:30000",
        }),
        StoreModule.forRoot(reducers, {}),
        EffectsModule.forRoot([
            VinEffects,
            OrigineEffects,
            TypeEffects,
            AppellationEffects,
        ]),
        IonApp,
        IonSplitPane,
        IonMenu,
        IonHeader,
        IonToolbar,
        IonTitle,
        IonContent,
        IonRouterOutlet,
        IonBadge,
        IonIcon,
        IonList], providers: [
        { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
        provideIonicAngular(),
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {}

// required for AOT compilation
export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, "./assets/i18n/", ".json");
}
