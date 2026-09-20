/**
 * A deliberately small Markdown subset for insight bodies.
 *
 * Insights are written by administrators, but "trusted author" is not a reason
 * to render arbitrary HTML: an account can be compromised, and a stored XSS in
 * a public page is the worst possible outcome. So the input is HTML-escaped
 * first and only a fixed set of constructs is then reintroduced. There is no
 * path by which author text becomes a tag.
 *
 * Supported: headings (## and ###), paragraphs, unordered and ordered lists,
 * bold, italic, inline code, and links with an http(s) or mailto target.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only absolute http(s) and mailto links are rendered; anything else is not a link. */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  return /^(https?:\/\/|mailto:)[^\s"'<>]+$/i.test(trimmed) ? trimmed : null;
}

function renderInline(escaped: string): string {
  return (
    escaped
      // `code`
      .replace(/`([^`]+)`/g, '<code class="rounded bg-cream px-1 py-0.5 font-mono text-xs">$1</code>')
      // [label](href) — the href is checked, and a rejected one keeps its text.
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label: string, href: string) => {
        const safe = safeHref(href.replace(/&amp;/g, "&"));
        return safe
          ? `<a href="${escapeHtml(safe)}" class="text-accent-green underline-offset-2 hover:underline" rel="noopener noreferrer">${label}</a>`
          : label;
      })
      // **bold** then *italic*, in that order so ** is not read as two *.
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-ink-900">$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  );
}

export function renderMarkdown(source: string): string {
  const lines = escapeHtml(source).split(/\r?\n/);
  const html: string[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    html.push(
      `<p class="mb-4 leading-relaxed">${renderInline(paragraph.join(" ").trim())}</p>`
    );
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    const tag = listOrdered ? "ol" : "ul";
    const style = listOrdered ? "list-decimal" : "list-disc";
    html.push(
      `<${tag} class="mb-4 ml-5 space-y-1 ${style}">${listItems
        .map((item) => `<li class="leading-relaxed">${renderInline(item)}</li>`)
        .join("")}</${tag}>`
    );
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1]!.length;
      const classes =
        level === 2
          ? "mt-8 mb-3 text-xl font-bold text-ink-900"
          : "mt-6 mb-2 text-base font-bold text-ink-900";
      html.push(`<h${level} class="${classes}">${renderInline(heading[2]!)}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      if (listOrdered) flushList();
      listOrdered = false;
      listItems.push(bullet[1]!);
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ordered) {
      flushParagraph();
      if (!listOrdered) flushList();
      listOrdered = true;
      listItems.push(ordered[1]!);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return html.join("");
}
