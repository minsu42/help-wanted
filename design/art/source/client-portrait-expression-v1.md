# Client Portrait Expression v1 — Source Record

**Date:** 2026-08-10
**Tool:** OpenAI built-in image generation
**Reference:** `design/art/targets/counter-visual-target-v2.png`

## Prompt

Create exactly four evenly spaced front-facing chest-up pixel portraits of the same approved
villager in one horizontal row: neutral, tell, ignorance, and concealment. Preserve the identical
spiky dark-purple hair, tan skin, thick eyebrows, red scarf, green tunic, gray shoulder armor,
proportions, crop, light direction, palette, outline, and shoulder baseline. Change only eyes,
eyebrows, mouth, and at most a minimal head angle. Use hard-edged pixel clusters intended for a
64×64 final frame, with no antialiasing or gradients. Render on a uniform `#ff00ff` chroma-key
background with no shadows, text, labels, UI, scenery, props, watermark, or cropped body parts.

## Normalization

1. Removed the chroma key with the installed imagegen helper.
2. Split the source into four equal horizontal regions.
3. Cropped each alpha bound and aligned every frame bottom-center on 64×64.
4. Quantized the complete atlas to one shared 47-color palette.
5. Restored hard binary alpha and exported a 256×64 atlas.

