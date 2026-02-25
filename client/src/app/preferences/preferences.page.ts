import { Component, OnInit, signal, inject, effect } from "@angular/core";
import { Location } from "@angular/common";
import { CommonModule } from "@angular/common";
import { TranslateModule } from "@ngx-translate/core";
import { FormsModule } from "@angular/forms";

import Debugger from "debug";
import { TranslateService } from "@ngx-translate/core";
import { IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItemGroup, IonItemDivider, IonLabel, IonItem, IonSelect, IonSelectOption } from "@ionic/angular/standalone";

const debug = Debugger("app:preferences");

@Component({
    selector: "app-preferences",
    templateUrl: "./preferences.page.html",
    styleUrls: ["./preferences.page.scss"],
    standalone: true,
    imports: [CommonModule, TranslateModule, FormsModule, IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonItemGroup, IonItemDivider, IonLabel, IonItem, IonSelect, IonSelectOption]
})
export class PreferencesPage implements OnInit {
    private readonly location = inject(Location);
    private readonly translate = inject(TranslateService);

    // Convert to signals for reactive state management
    readonly language = signal<string>("en");
    readonly remoteDB = signal<string>("");
    readonly supportedLanguages: Map<string, string> = new Map([
        ["fr", "français"],
        ["en", "english"],
    ]);

    constructor() {
        // Effect to persist language changes
        effect(() => {
            const lang = this.language();
            if (lang) {
                window.localStorage.setItem("myCellar.language", lang);
            }
        });
    }

    ngOnInit() {
        debug("[ngOnInit]");
        // Load preferences from localStorage
        const storedLanguage = window.localStorage.getItem("myCellar.language");
        if (storedLanguage) {
            this.language.set(storedLanguage);
        }
        
        const tmpRemoteDB = localStorage.getItem("myCellar.remoteDBURL");
        if (tmpRemoteDB) {
            this.remoteDB.set(tmpRemoteDB.split("@")[1] || "");
        }
    }

    goBack() {
        this.location.back();
    }

    languageChange(val: any) {
        const newLanguage = val.detail.value;
        debug("Language Change:", val);
        
        // Update signal and apply translation
        this.language.set(newLanguage);
        this.translate.use(newLanguage).subscribe((changed) => {
            debug("Language changed successfully");
        });
    }
}
