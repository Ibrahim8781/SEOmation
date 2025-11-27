import { z } from 'zod';

export const setWpSiteSchema = z.object({
  body: z.object({
    siteUrl: z.string().url()
  })
});
