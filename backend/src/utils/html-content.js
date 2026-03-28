import sanitizeHtml from 'sanitize-html';

const ABSOLUTE_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/i;
const DOMAIN_LIKE_PATTERN =
  /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:[/:?#].*)?$/i;

const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'pre',
  'code',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'hr',
  'a',
  'img',
  'figure',
  'figcaption'
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  code: ['class'],
  pre: ['class']
};

export function normalizeLinkUrl(url) {
  const value = String(url || '').trim();
  if (!value) return value;

  if (
    ABSOLUTE_SCHEME_PATTERN.test(value) ||
    value.startsWith('//') ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('#')
  ) {
    return value;
  }

  if (DOMAIN_LIKE_PATTERN.test(value)) {
    return `https://${value}`;
  }

  return value;
}

export function sanitizeContentHtml(html) {
  const source = String(html || '');
  if (!source) {
    return source;
  }

  return sanitizeHtml(source, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https']
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = normalizeLinkUrl(attribs.href || '');
        return {
          tagName,
          attribs: {
            ...(href ? { href } : {}),
            ...(href ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {}),
            ...(attribs.title ? { title: attribs.title } : {})
          }
        };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...(attribs.src ? { src: attribs.src } : {}),
          ...(attribs.alt ? { alt: attribs.alt } : {}),
          ...(attribs.title ? { title: attribs.title } : {}),
          ...(attribs.width ? { width: attribs.width } : {}),
          ...(attribs.height ? { height: attribs.height } : {})
        }
      })
    }
  });
}

export function normalizeContentLinksInHtml(html) {
  return sanitizeContentHtml(html);
}

export function sanitizeContentRecord(record) {
  if (!record || typeof record !== 'object') return record;
  if (record.html === undefined) return record;
  return {
    ...record,
    html: sanitizeContentHtml(record.html)
  };
}
