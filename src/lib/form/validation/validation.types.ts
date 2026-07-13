/**
 * Property stamped onto a repeatable row's own `formGroup` (by
 * `RepeatableFormBaseComponent`) carrying that row's current array position.
 * `with-validation` walks a control's `.parent` chain looking for this to
 * scope server-side `items.<n>.<field>` errors to the row that raised them,
 * instead of matching every row with a same-named field.
 */
export const ROW_INDEX_KEY = '__rowIndex';

export const errorTypes = [
  'required',
  'requireRelative',
  'email',
  'min',
  'max',
  'minlength',
  'maxlength',
  'pattern',
  'invalidDate',
  'invalidYear',
  'domainName',
  'date',
  'age',
  'inCollection',
  'notInCollection',
  'unicode',
  'float',
  'numeric',
  'whitespace',
  'equalTo',
  'serverError'
] as const;

export type ErrorTypes = (typeof errorTypes)[number];

export const ERROR_MESSAGES: { [key: string]: (...args: any) => string } = {
  required: (formControlName: string) => `${formControlName} is required.`,
  requireRelative: (formControlName: string) => `${formControlName} is required.`,
  email: (formControlName: string) => `${formControlName} must be a valid email address.`,
  min: (formControlName, requirement) => `${formControlName} must be at least ${requirement}.`,
  max: (formControlName, requirement) => `${formControlName} must be no more than ${requirement}.`,
  minlength: (formControlName, requirement) => `${formControlName} must be at least ${requirement} characters.`,
  maxlength: (formControlName, requirement) => `${formControlName} must be no more than ${requirement} characters.`,
  pattern: (formControlName) => `${formControlName} format is invalid.`,
  invalidDate: () => `This is not a valid date.`,
  invalidYear: () => `Date of Birth must be after year 1900.`,
  domainName: (formControlName, message) => message ?? `${formControlName} must be a valid domain name.`,
  date: (formControlName, message) => message ?? `${formControlName} must be a valid date.`,
  age: (formControlName, message) => message ?? `${formControlName} must be a valid age.`,
  inCollection: (formControlName, message) => message ?? `${formControlName} must be one of the allowed values.`,
  notInCollection: (formControlName, message) => message ?? `${formControlName} is not allowed.`,
  unicode: (formControlName, message) => message ?? `${formControlName} must be a valid unicode value.`,
  float: (formControlName, message) => message ?? `${formControlName} must be a number.`,
  numeric: (formControlName, message) => message ?? `${formControlName} must be numeric.`,
  whitespace: (formControlName, message) => message ?? `${formControlName} cannot contain whitespace.`,
  equalTo: (formControlName, message) => message ?? `${formControlName} does not match.`,
  serverError: (formControlName, message) => message ?? `${formControlName} was rejected by the server.`
};
