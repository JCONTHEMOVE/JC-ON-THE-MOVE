import { z } from "zod";

export const companyMetaPageCredentialSchema = z.object({
  pageId: z.string().trim().regex(/^\d{5,30}$/, "Invalid Facebook Page ID"),
  accessToken: z.string().trim().min(20).max(4096),
});

export const companyMetaPageCredentialsSchema = z.object({
  pages: z.array(companyMetaPageCredentialSchema).min(1).max(10),
}).superRefine(({ pages }, context) => {
  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.pageId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each Facebook Page may be connected only once",
        path: ["pages"],
      });
      return;
    }
    seen.add(page.pageId);
  }
});

export function companyFacebookTargetKey(pageId: string) {
  const normalized = z.string().trim().regex(/^\d{5,30}$/).parse(pageId);
  return `facebook:${normalized}`;
}
