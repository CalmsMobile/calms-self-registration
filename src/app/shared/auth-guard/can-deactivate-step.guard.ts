import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanDeactivate, RouterStateSnapshot } from "@angular/router";
import { WizardService } from "../../core/services/wizard.service";
import { Observable } from "rxjs";

@Injectable()
export class CanDeactivateStepGuard implements CanDeactivate<unknown> {
  constructor(private wizardService: WizardService) {}

  canDeactivate(
    component: unknown,
    currentRoute: ActivatedRouteSnapshot,
    currentState: RouterStateSnapshot,
    nextState: RouterStateSnapshot
  ): boolean | Observable<boolean> {
    //return this.wizardService.canProceed$;
    return true;
  }
}