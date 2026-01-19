<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>
          <xsl:value-of select="rss/channel/title"/>
        </title>
        <style>
          :root {
            --bg: #f6f8fb;
            --panel: rgba(0, 0, 0, 0.03);
            --panel-2: rgba(0, 0, 0, 0.04);
            --text: rgba(10, 10, 10, 0.90);
            --muted: rgba(10, 10, 10, 0.62);
            --code: rgba(10, 10, 10, 0.72);
            --link: #0369a1;
            --border: rgba(0, 0, 0, 0.10);
            --shadow: 0 18px 45px rgba(10, 10, 10, 0.10);
            --radius: 14px;
          }

          html, body {
            height: 100%;
          }

          body {
            margin: 0;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
            background:
              radial-gradient(1200px 500px at 20% 0%, rgba(14, 165, 233, 0.16), transparent 60%),
              radial-gradient(900px 500px at 80% 20%, rgba(34, 197, 94, 0.12), transparent 60%),
              radial-gradient(900px 600px at 50% 100%, rgba(244, 63, 94, 0.08), transparent 55%),
              var(--bg);
            color: var(--text);
          }

          a {
            color: var(--link);
            text-decoration: none;
          }

          a:hover {
            text-decoration: underline;
          }

          .wrap {
            max-width: 980px;
            margin: 0 auto;
            padding: 28px 18px 64px;
          }

          .header {
            display: grid;
            gap: 12px;
            padding: 18px 18px 16px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: linear-gradient(180deg, var(--panel), transparent);
            box-shadow: var(--shadow);
          }

          .title {
            font-size: 22px;
            font-weight: 760;
            letter-spacing: -0.01em;
            line-height: 1.15;
          }

          .desc {
            color: var(--muted);
            font-size: 14px;
            line-height: 1.5;
          }

          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            color: var(--muted);
            font-size: 12px;
          }

          .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.04);
          }

          .list {
            margin-top: 18px;
            display: grid;
            gap: 12px;
          }

          .item {
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: rgba(255, 255, 255, 0.04);
            padding: 14px 16px;
          }

          .item:hover {
            background: rgba(255, 255, 255, 0.06);
          }

          .itemTitle {
            font-weight: 700;
            line-height: 1.25;
            letter-spacing: -0.01em;
          }

          .itemMeta {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            color: var(--muted);
            font-size: 12px;
          }

          .code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 12px;
            color: var(--code);
          }

          .hint {
            margin-top: 14px;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.45;
          }

          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0b1220;
              --panel: rgba(255, 255, 255, 0.06);
              --panel-2: rgba(255, 255, 255, 0.08);
              --text: rgba(255, 255, 255, 0.92);
              --muted: rgba(255, 255, 255, 0.64);
              --code: rgba(255, 255, 255, 0.78);
              --link: #7dd3fc;
              --border: rgba(255, 255, 255, 0.12);
              --shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
            }

            body {
              background:
                radial-gradient(1200px 500px at 20% 0%, rgba(125, 211, 252, 0.20), transparent 60%),
                radial-gradient(900px 500px at 80% 20%, rgba(34, 197, 94, 0.12), transparent 60%),
                radial-gradient(900px 600px at 50% 100%, rgba(244, 63, 94, 0.10), transparent 55%),
                var(--bg);
            }

            .header {
              background: linear-gradient(180deg, var(--panel), transparent);
            }

            .pill {
              background: rgba(255, 255, 255, 0.04);
            }

            .item {
              background: rgba(255, 255, 255, 0.04);
            }

            .item:hover {
              background: rgba(255, 255, 255, 0.06);
            }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="header">
            <div class="title">
              <xsl:value-of select="rss/channel/title"/>
            </div>
            <div class="desc">
              <xsl:value-of select="rss/channel/description"/>
            </div>
            <div class="meta">
              <span class="pill">
                <span>Site</span>
                <span class="code">
                  <xsl:value-of select="rss/channel/link"/>
                </span>
              </span>
              <span class="pill">
                <span>Language</span>
                <span class="code">
                  <xsl:value-of select="rss/channel/language"/>
                </span>
              </span>
              <span class="pill">
                <span>Items</span>
                <span class="code">
                  <xsl:value-of select="count(rss/channel/item)"/>
                </span>
              </span>
            </div>
            <div class="hint">
              This view is powered by an XSL stylesheet for human-friendly reading in browsers. RSS readers will still consume the raw XML.
            </div>
          </div>

          <div class="list">
            <xsl:for-each select="rss/channel/item">
              <div class="item">
                <div class="itemTitle">
                  <a>
                    <xsl:attribute name="href"><xsl:value-of select="link"/></xsl:attribute>
                    <xsl:value-of select="title"/>
                  </a>
                </div>
                <div class="itemMeta">
                  <span class="pill">
                    <span>Published</span>
                    <span class="code"><xsl:value-of select="pubDate"/></span>
                  </span>
                  <xsl:if test="string-length(guid) &gt; 0">
                    <span class="pill">
                      <span>GUID</span>
                      <span class="code"><xsl:value-of select="guid"/></span>
                    </span>
                  </xsl:if>
                  <xsl:if test="count(category) &gt; 0">
                    <span class="pill">
                      <span>Tags</span>
                      <span class="code">
                        <xsl:for-each select="category">
                          <xsl:value-of select="."/>
                          <xsl:if test="position() != last()">, </xsl:if>
                        </xsl:for-each>
                      </span>
                    </span>
                  </xsl:if>
                </div>
              </div>
            </xsl:for-each>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
