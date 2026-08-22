# Postgres for both the Enterprise Graph and the Work Graph

V8 (J4) mentions a Neo4j prototype for the Work Graph. We store both the Enterprise Graph and the Work Graph in Postgres instead: simpler operations for a prototype at this scale, and the F3/A2 edge types (`sequence`, `shared_object`, `shared_resource`, `reciprocal`) still map cleanly onto foreign-keyed tables. This is a deliberate stack choice, not a divergence from the conceptual model — revisit if graph-native traversal queries become a bottleneck.
