import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
  FormControl,
} from '@angular/forms';
import { EmpolyeeService } from '../../employee.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-employee-form',
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.css',
})
export class EmployeeFormComponent {
  selectedFile: File | null = null;
  previewImg = 'assets/placeholder.webp';
  employee: any;

  employeeForm!: FormGroup;

  skills = [
    { name: 'Java', selected: false },
    { name: 'Python', selected: false },
    { name: 'NodeJS', selected: false },
  ];

  isEditing: boolean = false;

  constructor(
    private employeeService: EmpolyeeService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {
    this.employeeForm = this.fb.group({
      employee_name: ['', Validators.required],
      employee_id: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      date_of_birth: [''],
      gender: [''],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^\d+$/)]],
      address: [''],
      skill: this.fb.array([]),
      department: [''],
      image: [''],
      education_backgrounds: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    this.addSkill();
    this.employee = history.state.employee;
    console.log(this.employee);

    if (this.employee) {
      this.isEditing = true;
      this.populateForm(this.employee);
      this.cdr.detectChanges();
    } else {
      this.isEditing = false;
    }
  }

  showSuccess(message: string) {
    this.toastr.success(message);
  }

  populateForm(data: any) {
    if (data.image == 'assets/placeholder.webp') {
      data.image = null;
    }
    this.employeeForm.patchValue({
      employee_name: data.employee_name,
      employee_id: data.employee_id,
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      email: data.email,
      phone: data.phone,
      address: data.address,
      department: data.department,
      image: data.image
        ? `http://localhost:8080/api${data.image}`
        : this.previewImg,
    });

    this.previewImg = this.employeeForm.value.image;
    console.log(this.previewImg);

    if (data.skill) {
      const skillArray = data.skill
        .split(',')
        .map((skill: string) => skill.trim());
      this.skills = this.skills.map((skill) => ({
        ...skill,
        selected: skillArray.includes(skill.name),
      }));
    }

    this.updateFormControl();

    this.educationBackgrounds.clear();
    if (data.education_backgrounds) {
      data.education_backgrounds.forEach((education: any) => {
        this.educationBackgrounds.push(
          this.fb.group({
            diploma: [education.diploma || ''],
            university_name: [education.university_name || ''],
            year: [education.year || ''],
          })
        );
      });
    }
  }

  get skillsArray(): FormArray {
    return this.employeeForm.get('skill') as FormArray;
  }

  addSkill() {
    this.skills.forEach((skill) => {
      this.skillsArray.push(new FormControl(skill.selected));
    });
  }

  updateFormControl() {
    this.skillsArray.clear();

    this.skills.forEach((skill) => {
      this.skillsArray.push(new FormControl(skill.selected));
    });
  }

  onSkillChange(skillName: string, isSelected: boolean) {
    const selectedSkill = this.skills.find((skill) => skill.name === skillName);
    if (selectedSkill) {
      selectedSkill.selected = isSelected;
    }

    const control = this.skillsArray.at(
      this.skills.findIndex((skill) => skill.name === skillName)
    );
    control.setValue(isSelected);
  }

  get educationBackgrounds(): FormArray {
    return this.employeeForm.get('education_backgrounds') as FormArray;
  }

  addInputGroup() {
    this.educationBackgrounds.push(
      this.fb.group({
        diploma: [''],
        university_name: [''],
        year: ['', Validators.pattern(/^\d+$/)],
      })
    );
  }

  deleteInputGroup(index: number) {
    this.educationBackgrounds.removeAt(index);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewImg = e.target.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  cancel() {
    this.router.navigate(['/employee']);
  }

  onSubmit() {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    const formData: FormData = new FormData();
    Object.entries(this.employeeForm.value).forEach(([key, value]) => {
      if (
        key === 'education_backgrounds' ||
        key === 'skill' ||
        key === 'image'
      ) {
        return;
      } else {
        formData.append(key, value as string);
      }
    });

    if (
      this.employeeForm.value.image.startsWith('http://localhost:8080/api/')
    ) {
      const re = /http\:\/\/localhost\:8080\/api/gi;
      this.employeeForm.value.image = this.employeeForm.value.image.replace(
        re,
        ''
      );
    }
    formData.append('image', this.employeeForm.value.image);

    const selectedSkills = this.employeeForm.value.skill
      .map((checked: boolean, i: number) => ({
        name: this.skills[i].name,
        selected: checked,
      }))
      .filter((skill: { name: string; selected: boolean }) => skill.selected);

    selectedSkills.forEach((skill: { name: string; selected: boolean }) => {
      formData.append('skill[]', skill.name);
    });

    this.educationBackgrounds.controls.forEach((group, index) => {
      formData.append(
        `education[${index}][diploma]`,
        group.get('diploma')?.value
      );
      formData.append(
        `education[${index}][university_name]`,
        group.get('university_name')?.value
      );
      formData.append(`education[${index}][year]`, group.get('year')?.value);
    });

    if (this.selectedFile) {
      formData.append('image_file', this.selectedFile, this.selectedFile.name);
    }

    if (this.isEditing) {
      this.employeeService.updateEmployee(formData, this.employee.id).subscribe(
        (response) => {
          console.log('Employee updated:', response);
          this.showSuccess('Data updated successfully!');
          this.cancel();
        },
        (error) => {
          console.error('Error updating employee:', error);
        }
      );
    } else {
      this.employeeService.createEmployee(formData).subscribe(
        (response) => {
          console.log('Employee created:', response);
          this.showSuccess('Employee created successfully!');
          this.cancel();
        },
        (error) => {
          console.error('Error creating employee:', error);
          if (
            error.status === 409 &&
            error.error.message === 'Email already exists.'
          ) {
            this.employeeForm
              .get('email')
              ?.setErrors({ emailExists: 'Email already exists' });
          }
          if (
            error.status === 409 &&
            error.error.message === 'Employee name already exists.'
          ) {
            this.employeeForm
              .get('employee_name')
              ?.setErrors({ nameExists: 'Employee name already exists' });
          }
          if (
            error.status === 409 &&
            error.error.message === 'Employee ID already exists.'
          ) {
            this.employeeForm
              .get('employee_id')
              ?.setErrors({ idExists: 'Employee ID already exists' });
          }
        }
      );
    }
  }

  onDelete() {
    if (confirm('Are you sure you want to delete this employee?')) {
      this.employeeService.deleteOneEmployee(this.employee.id).subscribe(
        () => {
          this.showSuccess('Employee deleted successfully!');
          this.cancel();
        },
        (error) => {
          console.error('Error deleting employee:', error);
        }
      );
    }
  }
}
