-- dev_notes status vocabulary changed from new|processed to the
-- untackled|waiting_for_input|plan_done|implemented_pending_review|done
-- lifecycle driven by the plan-from-notes skill. Map existing rows onto the
-- closest new value: "new" was always the just-dropped state (-> untackled);
-- "processed" meant a human had triaged/handled it by hand, which is what
-- "done" means going forward.
UPDATE "dev_notes" SET "status" = 'untackled' WHERE "status" = 'new';
UPDATE "dev_notes" SET "status" = 'done' WHERE "status" = 'processed';
