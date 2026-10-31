import { ruleSelectSource } from '../../../module/ai-support/services/tools.service';

describe('select_source rule (step 3 diagram)', () => {
  it('routes film/showtime queries to structured', () => {
    expect(ruleSelectSource('Phim nào đang chiếu?')).toBe('structured');
    expect(ruleSelectSource('suất chiếu rạp Quận 1')).toBe('structured');
    expect(ruleSelectSource('giá vé bao nhiêu?')).toBe('structured');
  });

  it('routes policy/faq to vector', () => {
    expect(ruleSelectSource('Chính sách hoàn vé thế nào?')).toBe('vector');
    expect(ruleSelectSource('Hướng dẫn sử dụng')).toBe('vector');
  });

  it('returns both when ambiguous', () => {
    expect(ruleSelectSource('xin chào')).toBe('both');
    expect(ruleSelectSource('rạp có chính sách gì cho phim Dune?')).toBe(
      'both',
    );
  });
});
