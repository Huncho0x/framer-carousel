# Framer Carousel

A horizontal carousel code component for Framer, with prev/next arrows underneath.

- Connect any canvas components to **Items**. Each card keeps its own size and design.
- Swipe on touch, drag with the mouse, or use the arrows. Cards snap into place.
- Arrows shrink on hover, squish while pressed, and bounce back on release. Motion is turned off for people who prefer reduced motion.

## Use it

In Framer, create a new code component and paste in [`Carousel.tsx`](Carousel.tsx).

## Arrow controls

| Control | Default | What it does |
| --- | --- | --- |
| Hover size | 0.92 | How small the arrow gets on hover (1 = no change) |
| Press size | 0.84 | How small it squishes while clicked |
| Bounce | 0.08 | How far it springs past its size after a click (0 = off) |
