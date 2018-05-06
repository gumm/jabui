import Panel from './panel.js';
import { UiEventType } from '../events/uieventtype.js';
import { insertSiblingAfter, removeNode, replaceNode, getFormDataMap,
  splitScripts } from '../dom/utils.js'

/**
 * A class for managing the display of field level messages on a form.
 */
class FieldErrs {

  constructor(form) {
    this.form_ = form;
    this.fMap = new Map();
  }

  checkAll() {
    const arr = [...this.form_.elements]
        .map(e => [this.checkValidationForField(e), e])
        .filter(e => !e[0]);
    arr.forEach(e => this.displayError(e[1]));
    return arr.length === 0;
  };

  /**
   * Format the message dom object and insert it into the DOM
   * @param {HTMLInputElement} field The field after which the
   *    alert will be inserted.
   * @param {string} msg The message in the alert.
   * @param {string} css A CSS class name to add to the alert div.
   *      This will be formatted bold.
   */
  displayAlert(field, msg, css) {
    const alertDom = document.getElementById(`${field.id}-helper-text`) || document.createElement('p');
    alertDom.textContent = msg;
    this.fMap.set(field, alertDom);
  };

  /**
   * @param {HTMLInputElement} field
   */
  checkValidationForField(field) {
    this.clearAlertOnField(field);
    let isValid = !field.willValidate;
    if (field.willValidate) {
      isValid = field.checkValidity();
    }
    return isValid;
  };

  /**
   * @param {HTMLInputElement} field
   */
  clearAlertOnField(field) {
    field.classList.remove('error');
    if (this.fMap.has(field)) {
      this.fMap.get(field).textContent = ''
    }
    this.fMap.delete(field);
  };

  /**
   * Display the given error message on the given form field.
   * @param {HTMLInputElement} field
   * @param {string=} opt_msg
   */
  displayError(field, opt_msg) {
    let message = opt_msg || field.validationMessage;
    field.classList.add('error');
    this.displayAlert(field, message, 'alert-error');
  };

  /**
   * Display the given success message on the given form field.
   * @param {HTMLInputElement} field
   * @param {string} message
   */
  displaySuccess(field, message) {
    this.displayAlert(field, message, 'alert-success');
  };

  /**
   * Display the given information message on the given form field.
   * @param {HTMLInputElement} field
   * @param {string} message
   */
  displayInfo(field, message) {
    this.displayAlert(field, message, 'alert-info');
  };

  /**
   * @param {Event} e
   */
  validateOnChange(e) {
    this.checkValidationForField(/** @type {HTMLInputElement} */ (e.target));
  }
}



class FormPanel extends Panel {

  constructor(uri) {
    super(uri);

    /**
     * @type {?HTMLFormElement}
     * @private
     */
    this.form_ = null;

    /**
     * @type {!FieldErrs|undefined}
     * @private
     */
    this.fieldErr_ = void 0;

    /**
     * @type {function(!FormPanel):(?|null|Promise<?>)}
     */
    this.onSubmitSucFunc = panel => null;

  }

  /**
   * @inheritDoc
   */
  enterDocument() {
    super.enterDocument();
    this.formIdElementToForm_();
  };


  /**
   * @private
   */
  formIdElementToForm_() {
    this.form_ = this.getFormFromId();
    if (this.form_) {
      this.fieldErr_ = new FieldErrs(this.form_);
      this.interceptFormSubmit(this.form_);
      this.form_.addEventListener(
          'change', e => {this.fieldErr_.validateOnChange(e)}, {passive: true});
      this.form_.addEventListener('invalid', e => {
        e.preventDefault();
        const field = /** @type {HTMLInputElement} */ (e.target);
        this.fieldErr_.clearAlertOnField(field);
        this.fieldErr_.displayError(field);
      }, {passive: true});
    }
  };


  /**
   * @param {string=} string The id of the form we want to sterilise.
   * @return {?HTMLFormElement}
   */
  getFormFromId(string) {
    let form = null;
    let el = this.getElement().querySelector('form');
    if (string) {
      el = document.getElementById(/** @type {string} */(string)) || el;
    }
    if (el && el.tagName.toLowerCase() === 'form') {
      form = /** @type {HTMLFormElement} */ (el);
    }
    return form;
  };


  /**
   * @return {?HTMLFormElement}
   */
  getForm() {
    return this.form_;
  };


  /**
   * Given a form id, get the form, and intercept and sterilise its submit.
   * Forms that passed through here will not be able to be submitted with a
   * normal submit button any more, but built in HTML5 Constraint Validation
   * will still function on the form. This way, we can still have a button with
   * type="submit", which will trigger the validation, and we can submit
   * valid forms with xhrio which allows us to add callbacks to them.
   *
   * @param {?HTMLFormElement} form The form we want to sterilise.
   * @return {?HTMLFormElement}
   */
  interceptFormSubmit(form) {
    form.noValidate = true;
    const user = this.user;
    this.listen(form, 'submit', e => {
      e.preventDefault();
      if (this.fieldErr_ && this.fieldErr_.checkAll()) {
        user && user.formSubmit(this);
      }
    });
    return form;
  };


  // /**
  //  * Get the post content of this form as a content string.
  //  * @return {!Object}
  //  */
  // getFormDataMapObject() {
  //   return getFormDataMap(this.form_).toObject();
  // };


  // /**
  //  * Get the post content of this form as a content string.
  //  * @return {string}
  //  */
  // getPostContentFromForm() {
  //   return goog.uri.utils.buildQueryDataFromMap(this.getFormDataMapObject());
  // };


  //--------------------------------------------------------[ Alert Messages ]--
  // /**
  //  * @param {!Object} obj
  //  */
  // showErrs(obj) {
  //   const f = this.getForm();
  //   const err = this.fieldErr_.displayError.bind(this.fieldErr_);
  //   Object.keys(obj).forEach(k => {
  //     if (k === 'non_field_errors') {
  //       err(f, obj[k].reduce((p, c) => `${p}${p === '' ? c : '\n' + c}`, ''));
  //     }
  //   });
  // };


  /**
   * Clear all existing errors
   */
  clearErrs() {
    let fields = this.form_ ? this.form_.elements : [];
    Array
        .from(
            /** @type {!HTMLFormControlsCollection<!HTMLElement>} */ (fields))
        .forEach(field => this.fieldErr_.clearAlertOnField(field));

    let nonFieldErrs = this.getElement().querySelector(
        '.zform_alert__non-field-errors');
    nonFieldErrs && nonFieldErrs.remove();
  };


  //------------------------------------------------------------[ Round Trip ]--
  /**
   * @param {function(!FormPanel):(?|null|Promise<?>)} func
   */
  onSubmitSuccess(func) {
    this.onSubmitSucFunc = func;
  };

  /**
   * Given a 'fetch' reply, replace the form.
   * This simply replaced the form element with what came back from the server
   * and re-reads the scripts.
   * @param {string} reply
   */
  replaceForm(reply) {

    this.responseObject = splitScripts(reply);
    if (this.responseObject.html) {
      if (this.redirected) {
        const el = this.getElement();
        // Replace the whole innards of the panel.
        el.replaceChild(this.responseObject.html, el.firstElementChild);
      } else {
        // Just replace the form component.
        let newForm = /** @type {!Element} */ (this.responseObject.html).querySelector('form');
        if (newForm) {
          replaceNode(newForm, this.form_);
        }
      }
      this.enterDocument();
      }
    if (this.responseObject.scripts) {
      this.evalScripts(this.responseObject.scripts);
    }
  };


  /**
   * Expects HTML data from a call to the back.
   * @return {Promise} Returns a promise with this panel as value.
   */
  refreshFromFromServer() {
    const usr = this.user;
    const uri = this.uri;
    if (usr) {
      return usr.fetch(uri).then(s => this.replaceForm(s));
    } else {
      return Promise.reject('No user')
    }
  };


  /**
   * @param {string} reply
   * @return {Promise}
   */
  processSubmitReply(reply) {

    this.clearErrs();
    let success = false;

    if (reply === 'success') {
      //    console.log(`REDIRECTED: ${this.redirected}\nREPLY: ${reply}`);
      // We are done.
      // Nothing further to do here.
      success = true;
    } else if (reply === 'redirected_success\n') {
      //    console.log(`REDIRECTED: ${this.redirected}\nREPLY: ${reply}`);
      // Indicate that we were redirected, but are done.
      // Nothing further to do here. Set the 'redirected' flag to false,
      // and we will fall through to the correct response below.
      success = true;
      this.redirected = false;
    } else {
      //    console.log(`REDIRECTED: ${this.redirected}\nREPLY: Some form HTML`);
      // We received something other than a simple "we are done".
      // Replace the form (there may be server side error messages in it)
      // and look for the error objects.
      // Our success depends on finding error objects.
      this.replaceForm(reply);
      let hasErrors = this.form_.querySelectorAll('alert-error');
      success = !hasErrors.length
      }

    if (success && this.redirected) {
      //    console.log(`REDIRECTED: ${this.redirected}\nSUCCESS: ${success}`);
      // Just return the promise - we are not done yet.
      this.redirected = false;
      return Promise.resolve(this);
    } else if (success) {
      //    console.log(`REDIRECTED: ${this.redirected}\nSUCCESS: ${success}`);
      // We are done. Execute any 'onSuccess' directives, and
      // then fire the 'FORM_SUBMIT_SUCCESS' event.
      return Promise.resolve(this).then(p => {
        this.onSubmitSucFunc(this);
        this.dispatchCompEvent(UiEventType.FORM_SUBMIT_SUCCESS);
      });
    } else {
      //    console.log(`REDIRECTED: ${this.redirected}\nSUCCESS: ${success}`);
      // 'success' flag is not set. The form probably has errors.
      // Reject the promise.
      return Promise.reject('Form has errors');
    }
  };
}

export default FormPanel;