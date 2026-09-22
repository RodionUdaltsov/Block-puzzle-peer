# Mobile FX pass — v3.9.31

The mobile profile no longer disables the game's signature legendary visuals.

## Preserved
- Legendary prism/holographic material.
- Legendary field ambience: Nebula, Solar, Quantum, Abyss, Prismfield.
- Animated field borders and ambient sweeps.
- Legendary place/clear one-shot animations.
- Individual hologram animation on the three tray pieces and drag ghost.

## Optimization
The expensive part of the previous mobile profile was the legendary board: up to 64 filled cells could each own a continuously animated conic-gradient hologram layer. On touch devices v3.9.31 replaces the board's 64 independent moving layers with one shared `.prism-mobile-sheen` overlay. Cell hologram textures remain visible as static material; the shared overlay supplies the moving prism shimmer across the whole board.

This preserves the visual idea while reducing the number of continuously animated layers substantially. Desktop CSS is not changed by this mobile-only profile.
