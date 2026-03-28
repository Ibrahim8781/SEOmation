import { sanitizeContentHtml } from '../src/utils/html-content.js';

describe('sanitizeContentHtml', () => {
  test('removes script handlers and preserves basic formatting', () => {
    const html =
      '<h1 onclick="alert(1)">Hello</h1><p>Body <strong>text</strong><script>alert(1)</script></p>';

    const result = sanitizeContentHtml(html);

    expect(result).toContain('<h1>Hello</h1>');
    expect(result).toContain('<strong>text</strong>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('<script');
  });

  test('normalizes bare domain links to absolute https links', () => {
    const html = '<p><a href="www.google.com">Google</a></p>';

    const result = sanitizeContentHtml(html);

    expect(result).toContain('href="https://www.google.com"');
  });

  test('removes javascript urls from links', () => {
    const html = '<p><a href="javascript:alert(1)">Bad</a></p>';

    const result = sanitizeContentHtml(html);

    expect(result).toContain('<a');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('href=');
  });
});
