import { Component } from '@angular/core';
import { EmpolyeeService } from '../../employee.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-employee-list',
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.css',
})
export class EmployeeListComponent {
  employees: any[] = [];
  searchTerm: string = '';
  currentPage: number = 1;
  selectedFile: File | null = null;

  constructor(
    private router: Router,
    private employeeService: EmpolyeeService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.employees = [];
    this.employeeService.getAllEmployee().subscribe((data) => {
      this.employees = data.map((employee) => {
        if (employee.gender) {
          employee.gender =
            employee.gender.charAt(0).toUpperCase() +
            employee.gender.slice(1).toLowerCase();
        }
        return employee;
      });
    });
  }

  onRowClick(employee: any): void {
    this.router.navigate(['/employee/detail'], {
      state: { employee: employee },
    });
    console.log(employee);
  }

  exportFile() {
    this.employeeService.exportFile();
  }

  importFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }

    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    console.log('FormData contents:');
    for (const entry of formData.entries()) {
      const [key, value] = entry;
      console.log(`${key}: ${value}`);
    }

    this.employeeService.importFile(formData).subscribe({
      next: (response) => {
        console.log(response),
          window.location.reload(),
          this.toastr.success('Data imported successfully!');
      },
      error: (error: HttpErrorResponse) => {
        console.error('Upload failed:', error);

        if (error?.error?.message?.includes('email already exists')) {
          this.toastr.error('Employee with the same email already exists!');
        } else if (
          error?.error?.message?.includes('employee_id already exists')
        ) {
          this.toastr.error('Employee with the same ID already exists!');
        } else if (
          error?.error?.message?.includes(
            'Employee ID, Name, and Email are required.'
          )
        ) {
          this.toastr.error('Employee ID, Name, and Email are required.');
        } else {
          this.toastr.error('Invalid format!');
        }
        this.router
          .navigateByUrl('/', { skipLocationChange: true })
          .then(() => {
            this.router.navigate([this.router.url]);
          });
      },
    });
  }

  searchEmployees(): void {
    this.employees = [];

    this.employeeService.searchEmployees(this.searchTerm).subscribe(
      (data) => {
        this.employees = data;
      },
      (error) => {
        console.error('Error fetching employees:', error);
      }
    );
    this.currentPage = 1;
  }
}
