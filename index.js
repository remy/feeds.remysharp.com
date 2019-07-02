const cheerio = require('cheerio');
const fetch = require('node-fetch');
const write = require('fs').writeFileSync;
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt({
  linkify: true,
});

const user = 'rem';
const bundle = 'web';

let cookie = '';

async function login() {
  const res = await fetch('https://pinboard.in/auth/', {
    method: 'post',
    redirect: 'manual',
    body: `username=${user}&password=${escape(process.env.PINBOARD_TOKEN)}`,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)',
    },
  });

  cookie = res.headers
    .raw()
    ['set-cookie'].map(s => s.split(';')[0].trim())
    .join('; ');
}

async function links() {
  const res = await fetch(`https://pinboard.in/u:${user}/bundle:${bundle}/`, {
    headers: {
      cookie,
    },
  });
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

      description = md
        .render(
          description.replace(/<\/?[^>]+(>|$)/g, '').replace(/&gt;/g, '>')
        )
        .trim();

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

function toJSON({ title, home, description, url, items }) {
  return {
    version: 'https://jsonfeed.org/version/1',
    title,
    home_page_url: home,
    description,
    author: {
      name: 'Remy Sharp',
      url: home,
      avatar: 'https://remysharp.com/images/avatar-300.jpg',
    },
    feed_url: url,
    items: items.map(({ title, url, description, pubDate, tags }) => ({
      id: url,
      url,
      title,
      date_published: pubDate.toJSON(),
      content_html: description,
      tags,
    })),
  };
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
  await login();
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
  write(
    __dirname + '/public/links.json',
    JSON.stringify(
      toJSON({
        title: `remy sharp's l:inks`,
        description: 'More [code] and all that jazz',
        home: 'https://remysharp.com/',
        url: 'https://feeds.remysharp.com/links.xml',
        items,
      })
    )
  );
}

main();
