-- Keep history, counts and the public feed fast as rows grow.

create index cooked_user_created_idx on cooked (user_id, created_at desc);
create index cooked_public_created_idx on cooked (created_at desc) where is_public;
create index scans_user_created_idx on scans (user_id, created_at desc);
create index recipes_source_idx on recipes (source);
