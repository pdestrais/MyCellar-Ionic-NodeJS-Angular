import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";

import { UserModel } from "../models/cellar.model";

import jwtDecode, { JwtPayload } from "jwt-decode";
import { environment } from "../../environments/environment";

import * as Debugger from "debug";

const debug = Debugger("app:authService");

const APIEndpoint = environment.APIEndpoint;

@Injectable({ providedIn: "root" })
export class AuthenticationService {
  private currentUserSubject: BehaviorSubject<UserModel | null> =
    new BehaviorSubject<UserModel | null>(null);
  public currentUser: Observable<UserModel | null> =
    new Observable<UserModel | null>();

  constructor(private http: HttpClient) {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      this.currentUserSubject = new BehaviorSubject<UserModel | null>(
        JSON.parse(storedUser) as UserModel
      );
    } else {
      this.currentUserSubject = new BehaviorSubject<UserModel | null>(null);
    }

    this.currentUser = this.currentUserSubject.asObservable();
  }

  public getCurrentUserSubject() {
    return this.currentUserSubject;
  }

  public get currentUserValue(): UserModel | null {
    return this.currentUserSubject ? this.currentUserSubject.value : null;
  }

  login(username: string, password: string) {
    let url: string = "";
    if (environment.production) url = window.location.origin + "/api/login";
    else url = environment.APIEndpoint + "/api/login"; // for dev purposes

    return this.http.post<any>(url, { username, password }).pipe(
      map((response) => {
        // login successful if the response return code is 'OK'. It then also contains a user element that contains a jwt token
        //debug('[login]Login API call returns : ' + JSON.stringify(response));

        if ((response.code = "OK")) {
          // store user details and jwt token in local storage to keep user logged in between page refreshes
          //localStorage.setItem('previousUser', JSON.stringify(this.currentUserValue));
          localStorage.setItem("currentUser", JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        }
        return response;
      })
    );
  }

  logout() {
    // remove user from local storage to log user out
    localStorage.setItem("previousUser", JSON.stringify(this.currentUserValue));
    localStorage.removeItem("currentUser");
    this.currentUserSubject.next(null);
  }

  getTokenExpirationDate(token: string): Date | null {
    const decoded = jwtDecode<JwtPayload>(token);

    if (decoded.exp === undefined) return null;

    const date = new Date(0);
    date.setUTCSeconds(decoded.exp);
    return date;
  }

  isTokenExpired(token?: string): boolean {
    if (!token)
      token = this.currentUserValue ? this.currentUserValue.token : undefined;
    if (!token) return true;

    const date = this.getTokenExpirationDate(token);
    if (!date || date === undefined) return false;
    return !(date.valueOf() > new Date().valueOf());
  }
}
