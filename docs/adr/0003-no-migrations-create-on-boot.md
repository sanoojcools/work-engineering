# No Alembic; schema is create-on-boot

`main.py` runs `Base.metadata.create_all` on startup instead of applying versioned migrations. Fast to iterate on while the schema is still moving, but it means a destructive model change (renaming or dropping a column) needs a fresh volume rather than a migration — there is no upgrade path for existing data yet. Introduce Alembic before this system holds data anyone cares about keeping across a schema change.
