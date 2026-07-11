import { defineWorkers } from 'ugly-app/shared';

// No cron tasks. (The dailyCleanup scaffold — raw Postgres SQL — was removed
// during the D1 migration since raw SQL does not run on D1.)
export const cronTasks = defineWorkers({});
