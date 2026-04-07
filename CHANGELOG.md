# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-04-07

### Added
- GitHub Actions workflow for automatic deployment to GitHub Pages
- JSON validation step in CI/CD pipeline using Python
- Comprehensive `.gitignore` configuration
- Professional README.md with badges, screenshot, and bilingual documentation
- Search highlighting for matched keywords
- Clear search button with Escape key support
- Loading animations with visual feedback
- Enhanced error handling with user-friendly messages
- ARIA live regions for screen reader support
- Keyboard navigation (Tab, Enter, Space, Escape, Arrow keys)
- Focus indicators for keyboard accessibility
- Search debouncing (300ms) for performance optimization

### Changed
- **Typography**: Upgraded to Noto Serif SC for better Chinese text readability
- **Font size**: Increased body text to 17px for better screen reading
- **Line height**: Increased to 1.7 for improved long-form text readability
- **Heading fonts**: Changed to EB Garamond for better visual hierarchy
- **Letter spacing**: Added negative letter spacing to headings
- **Search UX**: Enhanced with clear button and keyboard shortcut
- **Loading states**: Added aria-busy attributes for accurate status
- **Error handling**: Improved with detailed error messages
- **Performance**: Optimized DOM operations and event handling
- **README**: Enhanced with professional formatting and complete documentation

### Fixed
- Trailing commas in JSON files causing validation failures
- Missing commas between contentList and analysisList in JSON files
- GitHub Pages compatibility issue with directory listing check
- Mobile touch experience
- Search performance issues
- Direct file opening issue (requires HTTP server)

### Removed
- Directory listing check in loadChapters() for GitHub Pages compatibility
- Unnecessary comments in HTML structure

## [1.0.0] - 2026-04-07

### Added
- Initial project setup with index.html and JSON data files
- Chapter navigation with classification grouping
- Full-text search functionality across all chapters
- Claymorphism design system implementation
- Responsive design for desktop, tablet, and mobile
- Basic accessibility features (semantic HTML, ARIA labels)
- Smooth transitions and hover effects
- Loading states and user feedback
- Error handling for failed data loading

### Technical Details
- Pure HTML/CSS/JavaScript implementation (no dependencies)
- Modern CSS features: custom properties, Flexbox, Grid, Backdrop-filter
- Progressive enhancement approach
- Client-side JSON loading
- Search debouncing (300ms)
- CSS custom properties for easy theming

---

## Deployment

The project is automatically deployed to GitHub Pages via GitHub Actions:
- **Trigger**: Push to main branch
- **Workflow**: `.github/workflows/deploy.yml`
- **Validation**: JSON files validated before deployment
- **URL**: https://1998x-stack.github.io/maoZeDongYuLu/

---

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (responsive design)

---

## Data Source

- **Title**: 毛主席语录 | Mao Zedong Quotations
- **Author**: 毛泽东 | Mao Zedong
- **Language**: Chinese (中文)
- **UUID**: urn:uuid:273fd756-62f2-4858-8d67-99e08f24bba9
- **Total Chapters**: 35
- **Total Quotations**: 500+

---

## License

This project is for educational and research purposes only. The content copyright belongs to the original authors.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Contact

- **Project Repository**: https://github.com/1998x-stack/maoZeDongYuLu
- **Issues**: https://github.com/1998x-stack/maoZeDongYuLu/issues
- **Live Site**: https://1998x-stack.github.io/maoZeDongYuLu/

---

[Unreleased]: https://github.com/1998x-stack/maoZeDongYuLu/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/1998x-stack/maoZeDongYuLu/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/1998x-stack/maoZeDongYuLu/releases/tag/v1.0.0
