export interface SubTypeOption {
  code: string;
  label: string;
}

/**
 * Hardcoded map of event-type → available sub-types.
 * Only types listed here expose a sub-type picker in the form +
 * a per-sub-type staff section in settings.
 */
export const SUB_TYPES_BY_TYPE: Record<string, SubTypeOption[]> = {
  party: [
    { code: "one_zone", label: "רחבה אחת" },
    { code: "two_zones", label: "שתי רחבות" },
    { code: "three_zones", label: "שלוש רחבות" },
  ],
  concert: [
    { code: "small", label: "קטנה" },
    { code: "big", label: "גדולה" },
  ],
};

export function hasSubTypes(typeCode: string | null | undefined): boolean {
  if (!typeCode) return false;
  return (SUB_TYPES_BY_TYPE[typeCode]?.length ?? 0) > 0;
}

export function subTypeLabel(
  typeCode: string | null | undefined,
  subTypeCode: string | null | undefined,
): string | null {
  if (!typeCode || !subTypeCode) return null;
  const opts = SUB_TYPES_BY_TYPE[typeCode];
  if (!opts) return subTypeCode;
  return opts.find((o) => o.code === subTypeCode)?.label ?? subTypeCode;
}
