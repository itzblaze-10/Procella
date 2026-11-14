Split-flap departure-board text for destination names and short codes.

`Procella.FlapBoard({text, length, size})` renders a board; `Procella.flapTo(element, text)` flips it to new text, one cell after another (`dur-flip` per flip).

- Uppercase letters, digits and `. + -` only. Keep to 12 cells or fewer; use `size: "sm"` in tight spaces.
- The board has `role="img"` and an `aria-label` with the final text, so screen readers hear the destination once.
- Reduced motion sets the text at once. Never flip continuously or flip more than one board at a time.
- Use it for destinations and arrivals, never for statistics: numbers that matter appear as plain text in `figure-xl`.
