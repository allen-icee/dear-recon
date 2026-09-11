import Decimal from 'decimal.js';

/**
 * A lightweight decimal-safe utility for financial calculations.
 * Ensures we never use unsafe JS floating point arithmetic for money.
 */
export class Money {
  private amount: Decimal;
  public currencyCode: string;

  constructor(amount: string | number | Decimal, currencyCode: string) {

    this.amount = new Decimal(amount);
    this.currencyCode = currencyCode.toUpperCase();
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.add(other.amount), this.currencyCode);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.sub(other.amount), this.currencyCode);
  }

  public multiply(multiplier: number | string): Money {
    return new Money(this.amount.mul(new Decimal(multiplier)), this.currencyCode);
  }

  public toString(): string {
    return this.amount.toFixed(2);
  }

  public toNumber(): number {
    return this.amount.toNumber();
  }
  
  public toDecimal(): Decimal {
    return this.amount;
  }

  private assertSameCurrency(other: Money) {
    if (this.currencyCode !== other.currencyCode) {
      throw new Error(`Currency mismatch: Cannot operate on ${this.currencyCode} and ${other.currencyCode}`);
    }
  }
}
