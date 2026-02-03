# THEME RULES DOCUMENTATION - FONT COLORS

## Overview
This document outlines the theme rules and font color standards for the CMRP Opportunities Management system, ensuring consistent visibility and accessibility across both light and dark themes.

## CSS Variables System

### Light Theme Variables
```css
:root {
    --bg-body: #f8f9fa;
    --text-body: #374151;
    --bg-container: #ffffff;
    --border-container: #e5e7eb;
    --text-title: #202124;
    --text-label: #6b7280;
    --text-header: #ffffff;
    --text-row: #374151;
}
```

### Dark Theme Variables
```css
.dark {
    --bg-body: #1e1e1e;
    --text-body: #e0e0e0;
    --bg-container: #2d2d2d;
    --border-container: #404040;
    --text-title: #ffffff;
    --text-label: #c0c0c0;
    --text-header: #ffffff;
    --text-row: #e0e0e0;
}
```

## Font Color Rules

### 1. Primary Text Colors

#### Body Text
- **Light Theme**: `#374151` (dark gray)
- **Dark Theme**: `#e0e0e0` (light gray)
- **Usage**: Main content, descriptions, labels
- **CSS Variable**: `var(--text-body)`

#### Title Text
- **Light Theme**: `#202124` (very dark gray)
- **Dark Theme**: `#ffffff` (white)
- **Usage**: Headings, card titles, important labels
- **CSS Variable**: `var(--text-title)`

#### Label Text
- **Light Theme**: `#6b7280` (medium gray)
- **Dark Theme**: `#c0c0c0` (light gray)
- **Usage**: Form labels, secondary information
- **CSS Variable**: `var(--text-label)`

### 2. Specific Component Colors

#### Dashboard Cards
- **Values**: Use `var(--text-title)` for main metrics
- **Change Indicators**: 
  - Positive: `#10b981` (green) with `rgba(16, 185, 129, 0.1)` background
  - Negative: `#ef4444` (red) with `rgba(239, 68, 68, 0.1)` background

#### Table Headers
- **Light Theme**: `#ffffff` (white text on dark background)
- **Dark Theme**: `#ffffff` (white text)
- **CSS Variable**: `var(--text-header)`

#### Table Rows
- **Light Theme**: `#374151` (dark gray)
- **Dark Theme**: `#e0e0e0` (light gray)
- **CSS Variable**: `var(--text-row)`

### 3. Special Cases and Overrides

#### Comparison Period Label
**Problem**: Tailwind CSS classes can override theme variables
**Solution**: Explicit theme-specific overrides

```css
/* Light theme specific fix */
body:not(.dark) .text-sm.font-medium.mr-2 {
    color: #202124 !important;
}

/* Dark theme specific fix */
body.dark .text-sm.font-medium.mr-2 {
    color: #e0e0e0 !important;
}
```

#### Navigation Links
- **Active State**: Themed using CSS variables
- **Hover State**: Consistent across themes
- **Disabled State**: Reduced opacity

### 4. Status-Specific Colors

#### Opportunity Status Colors
- **OP100**: Green background with light green text
- **OP90**: Blue background with light blue text
- **OP60**: Yellow background with dark yellow text
- **OP30**: Orange background with dark orange text
- **LOST**: Red background with light red text

These colors are defined with both light and dark theme variants.

### 5. Implementation Guidelines

#### 1. Always Use CSS Variables
```css
/* Correct */
color: var(--text-body);

/* Avoid - hardcoded colors */
color: #374151;
```

#### 2. Override Tailwind When Necessary
```css
/* High specificity override for Tailwind classes */
body.dark .text-sm.font-medium {
    color: var(--text-body) !important;
}
```

#### 3. Test Both Themes
- Always verify text visibility in both light and dark modes
- Use browser dev tools to toggle themes during development
- Check contrast ratios for accessibility

#### 4. Consistent Delta Indicators
```css
.dashboard-delta.positive {
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.1);
}

.dashboard-delta.negative {
    color: #ef4444;
    background-color: rgba(239, 68, 68, 0.1);
}
```

### 6. Common Issues and Solutions

#### Issue 1: Tailwind Classes Override Theme Variables
**Solution**: Use higher specificity selectors with theme classes
```css
body.dark .tailwind-class {
    color: var(--text-body) !important;
}
```

#### Issue 2: Text Not Visible in One Theme
**Solution**: Explicit theme-specific overrides
```css
body:not(.dark) .element { color: #202124 !important; }
body.dark .element { color: #e0e0e0 !important; }
```

#### Issue 3: Inconsistent Status Colors
**Solution**: Use standardized status color variables
```css
--status-op100-bg: #14532d;
--status-op100-text: #dcfce7;
```

### 7. Quality Assurance Checklist

- [ ] Text is readable in both light and dark themes
- [ ] CSS variables are used instead of hardcoded colors
- [ ] High contrast maintained for accessibility
- [ ] Tailwind overrides have sufficient specificity
- [ ] Delta indicators use consistent green/red colors
- [ ] Status colors are standardized across components

### 8. Browser Testing

Test theme switching in:
- Chrome/Edge (Chromium-based)
- Firefox
- Safari (if applicable)

Verify:
- Theme persistence on page reload
- No flash of unstyled content
- Smooth theme transitions
- All text remains readable

---

**Last Updated**: June 8, 2025  
**Version**: 1.0  
**Maintained By**: Development Team
