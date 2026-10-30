/*
 * The meeting point of the flying mark (hero.js, bolt3d.js) and the film's bolt of light (evo-section.js,
 * evolution.js). The mark comes down the page and stops exactly over the bolt of light; then it dissolves and its
 * light becomes the points: they leave its surface where it burns away and settle into the bolt.
 * - active: the mark is flying (3D is on), so the points gather from it instead of on their own;
 * - gather: 0 → 1, how far the hand-over has gone (the scroll drives it, so it runs backwards too);
 * - from: the mark's box on screen, in viewport pixels { x, y, w, h };
 * - target: set by the film's stage, returns the bolt of light's box on screen, in viewport pixels.
 */
export const handoff = { active: false, gather: 0, from: null, target: null };
