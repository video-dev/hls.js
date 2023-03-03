import { AttrList } from '../utils/attr-list';
import { logger } from '../utils/logger';

// Avoid exporting const enum so that these values can be inlined
const enum DateRangeAttribute {
  ID = 'ID',
  CLASS = 'CLASS',
  START_DATE = 'START-DATE',
  DURATION = 'DURATION',
  END_DATE = 'END-DATE',
  END_ON_NEXT = 'END-ON-NEXT',
  PLANNED_DURATION = 'PLANNED-DURATION',
  SCTE35_OUT = 'SCTE35-OUT',
  SCTE35_IN = 'SCTE35-IN',
}

export function isDateRangeCueAttribute(attrName: string): boolean {
  return (
    attrName !== DateRangeAttribute.ID &&
    attrName !== DateRangeAttribute.CLASS &&
    attrName !== DateRangeAttribute.START_DATE &&
    attrName !== DateRangeAttribute.DURATION &&
    attrName !== DateRangeAttribute.END_DATE &&
    attrName !== DateRangeAttribute.END_ON_NEXT
  );
}

export function isSCTE35Attribute(attrName: string): boolean {
  return (
    attrName === DateRangeAttribute.SCTE35_OUT ||
    attrName === DateRangeAttribute.SCTE35_IN
  );
}

export class DateRange {
  public attr: AttrList;
  private _startDate: Date;
  private _endDate?: Date;
  private _badValueForSameId?: string;

  constructor(dateRangeAttr: AttrList, dateRangeWithSameId?: DateRange) {
    if (dateRangeWithSameId) {
      const previousAttr = dateRangeWithSameId.attr;
      for (const key in previousAttr) {
        if (
          Object.prototype.hasOwnProperty.call(dateRangeAttr, key) &&
          dateRangeAttr[key] !== previousAttr[key]
        ) {
          logger.warn(
            `DATERANGE tag attribute: "${key}" does not match for tags with ID: "${dateRangeAttr.ID}"`
          );
          this._badValueForSameId = key;
          break;
        }
      }
      // Merge DateRange tags with the same ID
      dateRangeAttr = Object.assign(
        new AttrList({}),
        previousAttr,
        dateRangeAttr
      );
    }
    this.attr = dateRangeAttr;
    this._startDate = new Date(dateRangeAttr[DateRangeAttribute.START_DATE]);
    if (DateRangeAttribute.END_DATE in this.attr) {
      const endDate = new Date(this.attr[DateRangeAttribute.END_DATE]);
      if (Number.isFinite(endDate.getTime())) {
        this._endDate = endDate;
      }
    }
  }

  get id(): string {
    return this.attr.ID;
  }

  get class(): string {
    return this.attr.CLASS;
  }

  get startDate(): Date {
    return this._startDate;
  }

  get endDate(): Date | null {
    if (this._endDate) {
      return this._endDate;
    }
    const duration = this.duration;
    if (duration !== null) {
      return new Date(this._startDate.getTime() + duration * 1000);
    }
    return null;
  }

  get duration(): number | null {
    if (DateRangeAttribute.DURATION in this.attr) {
      const duration = this.attr.decimalFloatingPoint(
        DateRangeAttribute.DURATION
      );
      if (Number.isFinite(duration)) {
        return duration;
      }
    } else if (this._endDate) {
      return (this._endDate.getTime() - this._startDate.getTime()) / 1000;
    }
    return null;
  }

  get plannedDuration(): number | null {
    if (DateRangeAttribute.PLANNED_DURATION in this.attr) {
      return this.attr.decimalFloatingPoint(
        DateRangeAttribute.PLANNED_DURATION
      );
    }
    return null;
  }

  get endOnNext(): boolean {
    return this.attr.bool(DateRangeAttribute.END_ON_NEXT);
  }

  get isValid(): boolean {
    return (
      !!this.id &&
      !this._badValueForSameId &&
      Number.isFinite(this.startDate.getTime()) &&
      (this.duration === null || this.duration >= 0) &&
      (!this.endOnNext || !!this.class)
    );
  }
}
