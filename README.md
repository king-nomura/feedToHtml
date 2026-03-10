# feedToHtml

[日本語版 README はこちら](README.ja.md)

A command-line tool that converts RSS feeds into HTML. Supports RSS 2.0 and Atom feeds with customizable HTML templates and monthly pagination.

## Features

- **Lightweight**: Minimal dependencies, runs on Node.js 20+
- **Flexible**: Custom HTML template support
- **Monthly Grouping**: Automatically organizes articles by publication month
- **Incremental Updates**: Only adds new articles to existing files
- **Automation-Ready**: Ideal for scheduled execution via cron jobs
- **Cross-Platform**: Works on Linux, macOS, and Windows

## Installation

```bash
git clone https://github.com/king-nomura/feedToHtml.git
cd feedToHtml
npm install
```

## Usage

### Basic Usage

```bash
node src/cli/main.js <RSS_URL>
```

Example:
```bash
node src/cli/main.js https://example.com/rss.xml
```

### Specify Output Directory

```bash
node src/cli/main.js <RSS_URL> --output <OUTPUT_DIR>
```

Example:
```bash
node src/cli/main.js https://example.com/rss.xml --output ./public
```

### Convert from Local File

```bash
node src/cli/main.js --file <LOCAL_FILE> --output <OUTPUT_DIR>
```

### Advanced Configuration with Config File

```bash
node src/cli/main.js <RSS_URL> --config <CONFIG_FILE>
```

Example:
```bash
node src/cli/main.js https://example.com/rss.xml --config config.json
```

### Output Structure

Articles are grouped by publication month and output in the following structure:

```
<output_dir>/
├── 2025/
│   ├── 2025-01.html
│   ├── 2025-02.html
│   └── ...
└── 2024/
    ├── 2024-11.html
    └── 2024-12.html
```

If existing HTML files are present, only new articles are appended (incremental update).

### Latest Page Redirect

By setting `latestPage` in the config file, a redirect HTML file is generated in the output directory that automatically redirects to the monthly page containing the most recent articles.

```json
{
  "latestPage": "latest.html"
}
```

With the above configuration, `<output_dir>/latest.html` is generated and redirects visitors to the latest monthly page (e.g., `2025/2025-03.html`).

> **Note**: For security reasons, paths that traverse above the output directory (e.g., using `../`) are rejected.

## Configuration File

The following options can be set via a JSON configuration file:

```json
{
  "templatePath": "./templates/custom.html",
  "timeout": 60,
  "outputDir": "./output",
  "latestPage": "latest.html",
  "dateFormat": {
    "locale": "ja-JP",
    "options": {
      "year": "numeric",
      "month": "long",
      "day": "numeric"
    }
  }
}
```

### Configuration Options

- `templatePath` (optional): Path to a custom HTML template
- `timeout` (optional): Network timeout in seconds (default: 60)
- `outputDir` (optional): Output directory path
- `dateFormat` (optional): Date format settings (follows Intl.DateTimeFormat)
- `latestPage` (optional): Filename for the redirect HTML to the latest article page (e.g., `"latest.html"`)

## HTML Templates

You can customize the default template to create your own HTML layout. The following placeholders are available:

### Feed Information
- `{{FEED_TITLE}}`: Feed title
- `{{FEED_DESCRIPTION}}`: Feed description
- `{{FEED_LINK}}`: Feed link
- `{{YEAR_MONTH}}`: Year and month (e.g., January 2025)

### Article Information (within ITEMS block)
- `{{#ITEMS}}...{{/ITEMS}}`: Article loop block
- `{{ITEM_TITLE}}`: Article title
- `{{ITEM_LINK}}`: Article link
- `{{ITEM_DESCRIPTION}}`: Article content
- `{{ITEM_DATE}}`: Publication date
- `{{ITEM_AUTHOR}}`: Author
- `{{ITEM_CATEGORIES}}`: Categories

### Navigation
- `{{MONTHLY_NAV}}`: Monthly navigation
- `{{GENERATION_DATE}}`: Generation timestamp

### Template Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>{{FEED_TITLE}}</title>
    <meta charset="UTF-8">
</head>
<body>
    <h1>{{FEED_TITLE}}</h1>
    <p>{{FEED_DESCRIPTION}}</p>

    {{#ITEMS}}
    <article>
        <h2><a href="{{ITEM_LINK}}">{{ITEM_TITLE}}</a></h2>
        <time>{{ITEM_DATE}}</time>
        <div>{{ITEM_DESCRIPTION}}</div>
    </article>
    {{/ITEMS}}

    <footer>
        Generated on {{GENERATION_DATE}}
    </footer>
</body>
</html>
```

## Automated Execution with cron

Example crontab entry for periodic RSS feed updates:

```bash
# Update RSS feed every hour
0 * * * * cd /path/to/feedToHtml && node src/cli/main.js https://example.com/rss.xml --output /var/www/html/feeds
```

## Exit Codes

The program returns the following exit codes:

- `0`: Success
- `1`: Network error
- `2`: Parse error
- `3`: Filesystem error
- `4`: Configuration error

## Supported Formats

- RSS 2.0
- Atom 1.0

## Requirements

- Node.js 20.0.0 or later

## Experimental: outboxtohtml

An experimental feature for converting ActivityPub Outbox (e.g., Mastodon) to HTML is also included.

```bash
node src/cli/outbox_main.js <OUTBOX_URL> --output <OUTPUT_DIR>
# or
node src/cli/outbox_main.js --file <LOCAL_FILE> --output <OUTPUT_DIR>
```

> **Note**: This feature is experimental and the API may change.

## Development

This project was developed with the help of [Claude Code](https://claude.ai/code), Anthropic's AI coding assistant.

### Running Tests

```bash
npm test
```

## License

MIT License

## Contributing

Bug reports and feature requests are welcome via [Issues](https://github.com/king-nomura/feedToHtml/issues).
