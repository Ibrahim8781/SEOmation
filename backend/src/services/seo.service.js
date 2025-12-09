const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

function stripHtml(html = '') {
  return String(html || '').replace(/<[^>]+>/g, ' ');
}

function toWords(text = '') {
  return stripHtml(text)
    .replace(/[^a-zA-Z0-9\s'-]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function severity(score, max) {
  if (!max) return 'warn';
  const pct = score / max;
  if (pct >= 0.8) return 'ok';
  if (pct >= 0.5) return 'warn';
  return 'error';
}

function countOccurrences(text, keyword) {
  if (!keyword) return 0;
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'gi');
  return (text.match(pattern) || []).length;
}

function escapeRegExp(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function headingStructureScore(html) {
  const h1 = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2 = (html.match(/<h2[^>]*>/gi) || []).length;
  const h3 = (html.match(/<h3[^>]*>/gi) || []).length;
  const hasHierarchy = h1 >= 1 && (h2 + h3) >= 2;
  let score = 0;
  let message = '';

  if (h1 === 0) {
    message = 'Add an H1 with your primary keyword.';
  } else if (!hasHierarchy) {
    score = 7;
    message = 'Add subheadings (H2/H3) to structure the article.';
  } else {
    score = 13;
    message = 'Heading structure looks solid.';
  }

  return { score, message, max: 15 };
}

function imageAltScore(html, images = []) {
  const altTextsFromHtml = Array.from(html.matchAll(/<img[^>]*alt=['"]([^'"]+)['"][^>]*>/gi)).map(
    (m) => m[1]
  );
  const combined = [...altTextsFromHtml, ...images.map((img) => img.altText).filter(Boolean)];

  if (combined.length === 0) {
    return { score: 4, message: 'Add images with descriptive alt text.', max: 10 };
  }

  const descriptive = combined.filter((t) => (t || '').trim().length >= 6);
  const score = clamp(Math.round((descriptive.length / combined.length) * 10), 5, 10);
  const message =
    descriptive.length === combined.length
      ? 'All images have descriptive alt text.'
      : 'Some images need better alt text.';

  return { score, message, max: 10, imageCount: combined.length };
}

function keywordScore(text, primaryKeyword, secondaryKeywords = []) {
  const words = toWords(text);
  const wordCount = words.length || 1;
  const density = primaryKeyword
    ? (countOccurrences(text, primaryKeyword) / wordCount) * 100
    : 0;
  let score = 0;
  let message = '';

  if (!primaryKeyword) {
    message = 'Provide a primary keyword for better targeting.';
  } else if (density < 0.8) {
    score = 6;
    message = 'Use the primary keyword a bit more naturally.';
  } else if (density > 3.5) {
    score = 8;
    message = 'Keyword density is high; avoid stuffing.';
  } else {
    score = 12;
    message = 'Keyword density looks healthy.';
  }

  const secondaryHits = (secondaryKeywords || []).reduce(
    (acc, kw) => acc + countOccurrences(text, kw),
    0
  );
  if (secondaryHits > 0) {
    score = clamp(score + 2, 0, 15);
  }

  return { score, message, max: 15, density: Number(density.toFixed(2)) };
}

function lengthScore(wordCount) {
  // Short-form friendly thresholds (still encourage longer drafts via prompt target).
  if (wordCount >= 400) {
    return { score: 15, message: 'Great depth; article is long enough.', max: 15 };
  }
  if (wordCount >= 300) {
    return { score: 13, message: 'Solid length for SEO.', max: 15 };
  }
  if (wordCount >= 250) {
    return { score: 11, message: 'Consider expanding sections for depth.', max: 15 };
  }
  if (wordCount >= 150) {
    return { score: 9, message: 'Content is a bit short; add more detail.', max: 15 };
  }
  if (wordCount >= 100) {
    return { score: 7, message: 'Content is short; expand sections.', max: 15 };
  }
  return { score: 4, message: 'Very short content; expand significantly.', max: 15 };
}

export const SeoService = {
  /**
   * Rule-based SEO scoring for live editor and persisted drafts.
   */
  scoreContent(input) {
    const {
      title = '',
      metaDescription = '',
      bodyHtml = '',
      primaryKeyword = '',
      secondaryKeywords = [],
      images = []
    } = input || {};

    const text = stripHtml(bodyHtml || '');
    const words = toWords(text);
    const wordCount = words.length;

    const components = [];

    // Title
    const titleMax = 15;
    let titleScore = 0;
    let titleMsg = '';
    const tLen = title.trim().length;
    if (tLen === 0) {
      titleMsg = 'Add a clear title.';
    } else {
      if (tLen >= 45 && tLen <= 70) {
        titleScore += 8;
        titleMsg = 'Title length is optimal.';
      } else if (tLen >= 30 && tLen <= 90) {
        titleScore += 6;
        titleMsg = 'Slightly adjust title length for best results.';
      } else {
        titleScore += 4;
        titleMsg = 'Title too short/long for search snippets.';
      }

      if (primaryKeyword && title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        titleScore += 5;
      } else {
        titleMsg += ' Include the primary keyword in the title.';
      }
    }
    components.push({
      id: 'title',
      label: 'Title',
      score: clamp(titleScore, 0, titleMax),
      max: titleMax,
      message: titleMsg.trim(),
      severity: severity(titleScore, titleMax)
    });

    // Meta description
    const metaMax = 10;
    let metaScore = 0;
    let metaMsg = '';
    const mLen = metaDescription.trim().length;
    if (mLen === 0) {
      metaMsg = 'Add a meta description (140-160 characters).';
    } else {
      if (mLen >= 140 && mLen <= 165) {
        metaScore += 6;
        metaMsg = 'Meta description length is solid.';
      } else if (mLen >= 110 && mLen <= 180) {
        metaScore += 4;
        metaMsg = 'Meta description could be tightened to 140-160 chars.';
      } else {
        metaScore += 2;
        metaMsg = 'Meta description far from ideal length.';
      }

      if (primaryKeyword && metaDescription.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        metaScore += 4;
      } else {
        metaMsg += ' Include the primary keyword in the description.';
      }
    }
    components.push({
      id: 'meta',
      label: 'Meta description',
      score: clamp(metaScore, 0, metaMax),
      max: metaMax,
      message: metaMsg.trim(),
      severity: severity(metaScore, metaMax)
    });

    // Headings
    const headingResult = headingStructureScore(bodyHtml || '');
    components.push({
      id: 'headings',
      label: 'Headings',
      score: headingResult.score,
      max: headingResult.max,
      message: headingResult.message,
      severity: severity(headingResult.score, headingResult.max)
    });

    // Keyword usage
    const keywordResult = keywordScore(text, primaryKeyword, secondaryKeywords);
    components.push({
      id: 'keywords',
      label: 'Keyword usage',
      score: keywordResult.score,
      max: keywordResult.max,
      message: keywordResult.message,
      severity: severity(keywordResult.score, keywordResult.max)
    });

    // Length
    const lengthResult = lengthScore(wordCount);
    components.push({
      id: 'length',
      label: 'Content length',
      score: lengthResult.score,
      max: lengthResult.max,
      message: lengthResult.message,
      severity: severity(lengthResult.score, lengthResult.max)
    });

    // Image alt
    const imageAlt = imageAltScore(bodyHtml || '', images);
    components.push({
      id: 'images',
      label: 'Image alt text',
      score: imageAlt.score,
      max: imageAlt.max,
      message: imageAlt.message,
      severity: severity(imageAlt.score, imageAlt.max)
    });

    const totalMax = components.reduce((acc, item) => acc + item.max, 0);
    const totalScore = components.reduce((acc, item) => acc + item.score, 0);
    const percent = totalMax ? Number(((totalScore / totalMax) * 100).toFixed(2)) : 0;

    return {
      total: percent,
      max: 100,
      components,
      meta: {
        wordCount,
        keywordDensity: keywordResult.density
      }
    };
  }
};
