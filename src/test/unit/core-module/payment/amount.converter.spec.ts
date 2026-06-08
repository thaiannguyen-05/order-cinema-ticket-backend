import {
  toIntAmount,
  toDecimalAmount,
} from '../../../../module/core-module/payment/amount.converter';

describe('AmountConverter', () => {
  describe('toIntAmount', () => {
    it('converts decimal amount to integer (multiply by 100)', () => {
      expect(toIntAmount(150000.5)).toBe(15000050);
    });

    it('handles whole numbers', () => {
      expect(toIntAmount(100000)).toBe(10000000);
    });

    it('handles small decimal amounts', () => {
      expect(toIntAmount(0.01)).toBe(1);
      expect(toIntAmount(0.99)).toBe(99);
    });

    it('rounds correctly for floating point edge cases', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      expect(toIntAmount(0.1 + 0.2)).toBe(30);
    });

    it('handles minimum valid amount', () => {
      expect(toIntAmount(1)).toBe(100);
    });
  });

  describe('toDecimalAmount', () => {
    it('converts integer amount back to decimal (divide by 100)', () => {
      expect(toDecimalAmount(15000050)).toBe(150000.5);
    });

    it('handles whole numbers', () => {
      expect(toDecimalAmount(10000000)).toBe(100000);
    });

    it('handles small amounts', () => {
      expect(toDecimalAmount(1)).toBe(0.01);
      expect(toDecimalAmount(99)).toBe(0.99);
    });

    it('preserves two decimal places', () => {
      expect(toDecimalAmount(100)).toBe(1);
      expect(toDecimalAmount(100050)).toBe(1000.5);
    });

    it('handles zero', () => {
      expect(toDecimalAmount(0)).toBe(0);
    });
  });

  describe('round-trip conversion', () => {
    it('preserves original value after toIntAmount -> toDecimalAmount', () => {
      const original = 150000.5;
      const intVal = toIntAmount(original);
      const decimalVal = toDecimalAmount(intVal);

      expect(decimalVal).toBe(original);
    });

    it('preserves whole number values', () => {
      const original = 200000;
      const intVal = toIntAmount(original);
      const decimalVal = toDecimalAmount(intVal);

      expect(decimalVal).toBe(original);
    });
  });
});
