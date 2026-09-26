Design the database from the implemented domain model as needed. Prefer the simplest normalized schema that is fast, maintainable, and correct. Avoid premature abstraction, duplicate state, unnecessary join tables, and derived values stored redundantly unless there is a measured performance reason.

All persistent configuration, feature flags, thresholds, toggles, defaults, limits, role-controlled settings, promotion rules, shipping settings, security settings, notification settings, and other runtime-adjustable values must live in the database. Do not hardcode business settings in application code unless they are true system constants required for startup or safety.

For performance and correctness:

* Add indexes based on actual query patterns, especially foreign keys, unique identifiers, status fields, timestamps, search keys, SKUs, order numbers, account emails, and frequently filtered columns
* Use proper unique constraints and foreign keys
* Use transactions for multi-step state changes
* Use atomic updates for inventory, wallet balances, reservations, payouts, and other race-sensitive operations
* Avoid N+1 query patterns
* Use pagination for potentially large datasets
* Snapshot historical business data where later edits must not change past records, especially orders, pricing, addresses, discounts, and financial records
* Prefer append-only ledgers/events for inventory, wallet, financial, audit, and other traceable state changes
* Archive or soft-delete records that must remain historically referenced instead of hard deleting them
* Keep operational tables small and queryable, moving large blobs/files to object/file storage and storing references in the database
* Use migrations for every schema change
* Enforce authorization in the application layer while also using database constraints wherever they can prevent invalid state

