import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const runQueueWorker = createServerFn({ method: "POST" })
  .handler(async () => {
    // ... logika worker
    return { processed: 0 };
  });
