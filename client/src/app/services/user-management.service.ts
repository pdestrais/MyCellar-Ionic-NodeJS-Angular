import { AuthenticationService } from './auth.service';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { UserModel } from '../models/cellar.model';

import * as jwt_decode from 'jwt-decode';
import { environment } from '../../environments/environment';

import * as Debugger from 'debug';

const debug = Debugger('app:authService');

const APIEndpoint = environment.APIEndpoint;

@Injectable({ providedIn: 'root' })
export class UserManagementService {
	private currentUserSubject: BehaviorSubject<UserModel>;
	public currentUser: Observable<UserModel>;
	private backendURL: string = '';

	constructor(private http: HttpClient, private authenticationService: AuthenticationService) {
		if (environment.production) this.backendURL = window.location.origin;
		else this.backendURL = 'http://localhost:5001'; // for dev purposes
	}

	updateUserData(user: UserModel) {
		let url = this.backendURL + '/api/updateUserData';
		return this.http.post<any>(url, user).pipe(
			map((result) => {
				if (result.user) {
					// adding token resulting from previous login to update user data
					let userTemp = JSON.parse(localStorage.getItem('currentUser'));
					result.user.token = userTemp.token;
					localStorage.setItem('currentUser', JSON.stringify(result.user));
					this.authenticationService.getCurrentUserSubject().next(result.user);
				}
				return result;
			})
		);
	}

	changePassword(username, oldpwd, newpwd) {
		let url = this.backendURL + '/api/changePassword';
		return this.http.post<any>(url, { username: username, oldPassword: oldpwd, newPassword: newpwd }).pipe(
			map((result) => {
				if (result.code) {
					// adding token resulting from previous login to update user data
					let userTemp = JSON.parse(localStorage.getItem('currentUser'));
				}
				return result;
			})
		);
	}

	processSignupRequest(user: UserModel) {
		let url = this.backendURL + '/api/processSignupRequest';
		return this.http.post<any>(url, user);
	}

	resetPassword(username) {
		let url = this.backendURL + '/api/resetPassword';
		return this.http.post<any>(url, { username: username });
	}
}
