// Canonical hand poses captured in the recorder ("Save as reference") and dropped into
// src/content/sign-references.json. Missing entries fall back to the written description.
import raw from '../../content/sign-references.json';
import type { SignId } from '../../engine/types';
import { signReferencesSchema, type SignReference } from '../recorder/recording';

const parsed = signReferencesSchema.safeParse(raw);

export const SIGN_REFERENCES: Partial<Record<SignId, SignReference>> = parsed.success
  ? parsed.data.references
  : {};

export function signReference(sign: SignId): SignReference | null {
  return SIGN_REFERENCES[sign] ?? null;
}
