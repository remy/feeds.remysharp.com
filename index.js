const cheerio = require('cheerio');
const fetch = require('node-fetch');
const write = require('fs').writeFileSync;
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

const user = 'rem';
const bundle = 'web';

async function links() {
  const res = await fetch(`https://pinboard.in/u:${user}/bundle:${bundle}/`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const items = $('.bookmark')
    .map((i, el) => {
      const $el = $(el);
      const $title = $el.find('a.bookmark_title');
      const title = $title.text().trim();
      const url = $title.attr('href');
      let description = $el.find('.description').html();
      if (description === null) {
        description = '';
      }

      description = md.render(description.replace(/<br>/g, ''));

      const tags = $el
        .find('.tag')
        .map((i, el) => {
          return $(el).text();
        })
        .get()
        .map(_ => _.trim());

      const pubDate = new Date(
        $el
          .find('.when')
          .attr('title')
          .replace('&nbsp;', '')
          .trim()
          .replace(/\./g, '-')
          .replace(/\s+/g, ' ')
      );

      return {
        title,
        url,
        description,
        tags,
        pubDate,
      };
    })
    .get();

  return items.sort((a, b) => {
    return a.pubDate.toJSON() < b.pubDate.toJSON() ? 1 : -1;
  });
}

function safe(text) {
  const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };
  return text.replace(/[<>&]/g, m => entities[m]);
}

function toRSS({ title, description, url, items }) {
  return `<?xml version="1.0" encoding="utf-8"?>
<rss
  version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${title}</title>
    <description>${description}</description>
    <link>${url}</link>
    <language>en</language>
    <atom:link href="${url}" rel="self" type="application/rss+xml" />
    ${items
      .map(
        ({ title, url, description, pubDate, tags }) => `
    <item>
      <title>${safe(title)}</title>
      <link>${safe(url)}</link>
      <pubDate>${pubDate.toUTCString()}</pubDate>
      <guid>${safe(url)}</guid>
      <description>
          <![CDATA[${description}]]>
      </description>
      ${tags.map(tag => `<category>${safe(tag)}</category>`).join('\n')}
    </item>
    `
      )
      .join('\n')}
  </channel>
</rss>
`;
}

async function main() {
  console.clear();
  const items = await links();
  write(
    __dirname + '/public/links.xml',
    toRSS({
      title: `remy sharp's l:inks`,
      description: 'More [code] and all that jazz',
      url: 'https://feeds.remysharp.com/links.xml',
      items,
    })
  );
}

main();
