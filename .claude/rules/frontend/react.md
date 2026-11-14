# Frontend — React

## Styling

**Tailwind CSS is the default.** All HTML/CSS/React UI output uses Tailwind utility classes.

- Never write a `<style>` block or custom CSS class unless Tailwind genuinely cannot handle the requirement.
- Standalone HTML artifacts: load via CDN — `<script src="https://cdn.tailwindcss.com"></script>`
- React/component output: assume Tailwind is installed; use utility classes directly.
- Use Tailwind's built-in responsive (`md:`, `lg:`), state (`hover:`, `focus:`, `dark:`), and design-token scale (spacing, color, type) — never hardcode raw values when a Tailwind token exists.
- When editing an existing skill that uses plain CSS, do not migrate its styling unless the task is specifically about that skill's styling.
