import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OriginesComponent } from './origines.component';

describe('OriginesComponent', () => {
  let component: OriginesComponent;
  let fixture: ComponentFixture<OriginesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OriginesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OriginesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
