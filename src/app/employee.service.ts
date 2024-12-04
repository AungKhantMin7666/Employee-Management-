import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class EmpolyeeService{
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private router: Router) {}

  createEmployee(data: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/employee`, data);
  }

  getAllEmployee(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/employee`);
  }

  searchEmployees(keyword: any): Observable<any> {
    let httpParams = new HttpParams();
    if (keyword) {
      httpParams = httpParams.set('keyword', keyword);
    }

    return this.http.get<any>(`${this.apiUrl}/employee`, {
      params: httpParams,
    });
  }

  getImg(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/employee/${id}/image`);
  }

  updateEmployee(data: FormData, id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/employee/${id}`, data);
  }

  deleteOneEmployee(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/employee/${id}`);
  }

  exportFile() {
    window.open(`${this.apiUrl}/export`, '_blank');
  }

  importFile(data: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/import`, data);
  }
}
