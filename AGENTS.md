# Repository instructions

## Database documentation

When changing database tables, columns, types, nullability, defaults, primary keys,
unique constraints, foreign keys, indexes, relationships, source-to-derived data
flows, or calculation and refresh rules, update `DATABASE_SCHEMA.md` in the same
change. This is an explicit user requirement.

Keep the data dictionary, table purposes and row granularity, relationship
diagrams, report/API dependencies, migration and refresh instructions, and review
date consistent with the final code. Distinguish logical JOIN relationships from
enforced foreign keys, and source-code inspection from live database verification.
Preserve existing user changes. Documentation work does not authorize running
database migrations or data rebuilds.
