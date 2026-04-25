import { toLabel } from './string.helpers';
import type { BadgeColor, ValueMap, ValueMapItem } from '../models/types';

/**
 * Option tuple used by `<choosable-control>`, `<selectable-control>`, and
 * any form control that binds to `{ name, value }[]`.
 */
export type EnumOption<V> = { name: string; value: V };

/**
 * Derive `{ name, value }[]` from an object-as-const enum.
 * Keys become display labels via `toLabel(key)`; values are preserved verbatim.
 *
 * @example
 *   export const CartStatuses = { DRAFT: 'draft', ACTIVE: 'active' } as const;
 *   export type CartStatus = (typeof CartStatuses)[keyof typeof CartStatuses];
 *
 *   static getStatusOptions() {
 *     return enumOptions(CartStatuses);
 *   }
 */
export function enumOptions<T extends Record<string, string | number>>(
  enumObj: T
): EnumOption<T[keyof T]>[] {
  return Object.entries(enumObj).map(([key, value]) => ({
    name: toLabel(key),
    value: value as T[keyof T]
  }));
}

/**
 * Derive `{ name, value }[]` from a tuple-as-const where values double as labels.
 * No key/label transformation — the raw value is used for both.
 *
 * @example
 *   export const BloodGroups = ['A+', 'A-', 'B+', ...] as const;
 *   export type BloodGroup = (typeof BloodGroups)[number];
 *
 *   static getBloodGroupOptions() {
 *     return tupleOptions(BloodGroups);
 *   }
 */
export function tupleOptions<V extends string | number>(
  tuple: readonly V[]
): EnumOption<V>[] {
  return tuple.map(v => ({ name: String(v), value: v }));
}

/**
 * Runtime type-guard: is this value a member of the enum?
 * Useful for narrowing request-side validation.
 *
 * @example
 *   if (isEnumValue(CartStatuses, input)) {
 *     // input: CartStatus
 *   }
 */
export function isEnumValue<T extends Record<string, string | number>>(
  enumObj: T,
  value: unknown
): value is T[keyof T] {
  return Object.values(enumObj).includes(value as T[keyof T]);
}

/**
 * Like `enumOptions`, but accepts per-value label overrides.
 * Intended for `@EntityMeta({ search: [{ type: 'select', options: ... }] })`
 * when search labels differ from listing / form labels.
 *
 * @example
 *   enumOptionsWithLabels(SalesOrderChannels, { pos: 'POS', online: 'Online' })
 */
export function enumOptionsWithLabels<T extends Record<string, string | number>>(
  enumObj: T,
  labels?: Partial<Record<T[keyof T], string>>
): EnumOption<T[keyof T]>[] {
  return enumOptions(enumObj).map(opt => ({
    name: labels?.[opt.value] ?? opt.name,
    value: opt.value
  }));
}

// ─── Enum metadata — labels + colors + icons + derived accessors ───────────

/**
 * Metadata inputs for an enum — label, optional color, optional icon per value.
 * - `labels` is required (exhaustive, TS-enforced) — drift killer for new enum values.
 * - `colors` and `icons` are optional — omit when not needed (e.g. Gender uses one uniform
 *   color applied at the decorator's outer `badgeColor`, not per-value).
 * - `defaults` covers `undefined` / missing values.
 */
export interface EnumMetaInput<V extends string | number> {
  labels: Record<V, string>;
  colors?: Record<V, BadgeColor>;
  icons?: Record<V, string>;
  defaults?: { label?: string; color?: BadgeColor; icon?: string };
}

/**
 * Returned API for an enum-meta binding. One source of truth for label / color / icon,
 * plus derived map-shaped accessors for `@EntityMeta` decorator consumers.
 */
export interface EnumMetaApi<V extends string | number> {
  /** Scalar accessors — used by components / templates / directives. */
  getLabel(value: V | undefined): string;
  getColor(value: V | undefined): BadgeColor | '';
  getIcon(value: V | undefined): string;

  /** `{ name, value }[]` for `<choosable-control>`, `<selectable-control>`, and
   *  `@EntityMeta({ search: [{ type: 'select', options: ... }] })`. Uses the display's
   *  own labels (not `toLabel`), so the form/search labels match everything else. */
  getOptions(): EnumOption<V>[];

  /** `Record<V, string>` — plain label-only map, for `valueMap` with a uniform outer
   *  `badgeColor` (e.g. Gender: one color for all values). */
  getLabelMap(): Record<V, string>;

  /** `Record<V, { label, color }>` — per-value-color `valueMap`, for status-style enums. */
  getValueMap(): Record<V, ValueMapItem>;
}

/**
 * Build metadata bindings for an object-as-const enum.
 * Co-locate the call **immediately below** the enum declaration so the value list
 * and its metadata stay visually paired (#3.2 / #3.13 in the Angular rulebook).
 *
 * @example
 *   export const CartStatuses = { DRAFT: 'draft', ACTIVE: 'active' } as const;
 *   export type CartStatus = (typeof CartStatuses)[keyof typeof CartStatuses];
 *
 *   export const CartStatusMeta = enumMeta(CartStatuses, {
 *     labels: { draft: 'Draft', active: 'Active' },
 *     colors: { draft: 'secondary', active: 'primary' },
 *     icons:  { draft: 'fa-edit', active: 'fa-shopping-cart' },
 *     defaults: { label: 'Unknown', color: 'secondary', icon: 'fa-question-circle' },
 *   });
 *
 *   // In @EntityMeta:
 *   //   options: CartStatusMeta.getOptions()                  // form/search
 *   //   valueMap: CartStatusMeta.getValueMap()                // per-value-color badge
 *   //   valueMap: CartStatusMeta.getLabelMap()  + badgeColor  // uniform-color badge
 */
export function enumMeta<T extends Record<string, string | number>>(
  enumObj: T,
  maps: EnumMetaInput<T[keyof T]>
): EnumMetaApi<T[keyof T]> {
  type V = T[keyof T];
  return buildMetaApi<V>(Object.values(enumObj) as V[], maps);
}

/**
 * Build metadata bindings for a tuple-as-const enum where values double as labels.
 *
 * Labels default to each value itself (no `toLabel` transform) — supply `labels` to override
 * only when a value needs a different display name.
 *
 * @example
 *   export const BloodGroups = ['A+', 'A-', 'B+', 'B-', ...] as const;
 *   export type BloodGroup = (typeof BloodGroups)[number];
 *
 *   export const BloodGroupMeta = tupleMeta(BloodGroups, {
 *     // labels default to the value itself
 *     colors: { 'A+': 'danger', 'A-': 'danger', 'B+': 'warning', 'B-': 'warning', ... },
 *   });
 */
export function tupleMeta<V extends string | number>(
  tuple: readonly V[],
  maps: Partial<EnumMetaInput<V>> = {}
): EnumMetaApi<V> {
  const labels: Record<V, string> = maps.labels
    ?? (Object.fromEntries(tuple.map(v => [v, String(v)])) as Record<V, string>);
  return buildMetaApi<V>(tuple as readonly V[] as V[], {
    ...maps,
    labels,
  } as EnumMetaInput<V>);
}

function buildMetaApi<V extends string | number>(
  values: readonly V[],
  maps: EnumMetaInput<V>
): EnumMetaApi<V> {
  const { labels, colors, icons, defaults } = maps;
  const defaultLabel = defaults?.label ?? '';
  const defaultColor: BadgeColor | '' = defaults?.color ?? '';
  const defaultIcon  = defaults?.icon  ?? '';

  // Build derived maps once — enums are static, no reason to recompute.
  const labelMap = { ...labels } as Record<V, string>;
  const valueMap = Object.fromEntries(
    values.map(v => [v, {
      label: labels[v],
      ...(colors ? { color: colors[v] } : {}),
      ...(icons  ? { icon:  icons[v]  } : {}),
    }])
  ) as Record<V, ValueMapItem>;
  const options: EnumOption<V>[] = values.map(v => ({ name: labels[v], value: v }));

  return {
    getLabel: (v) => v === undefined ? defaultLabel : (labels[v] ?? defaultLabel),
    getColor: (v) => v === undefined ? defaultColor : (colors?.[v] ?? defaultColor),
    getIcon:  (v) => v === undefined ? defaultIcon  : (icons?.[v]  ?? defaultIcon),
    getOptions:  () => options,
    getLabelMap: () => labelMap,
    getValueMap: () => valueMap,
  };
}

// Re-export ValueMap type for consumers that need to type inline valueMap literals.
export type { ValueMap };
