-- Create waiter_calls table for tracking table service requests
create table if not exists waiter_calls (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  table_name text not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  
  -- Indexes
  unique(id)
);

-- Add RLS policies
alter table waiter_calls enable row level security;

-- Allow authenticated users to view and insert their own calls
create policy "Users can insert their own waiter calls"
  on waiter_calls
  for insert
  with check (auth.uid() = user_id);

-- Allow authenticated users to view waiter calls
create policy "Users can view waiter calls"
  on waiter_calls
  for select
  using (true);

-- Allow authenticated users to update waiter calls
create policy "Users can update waiter calls"
  on waiter_calls
  for update
  using (true);

-- Create index for faster queries
create index if not exists waiter_calls_user_id_idx on waiter_calls(user_id);
create index if not exists waiter_calls_status_idx on waiter_calls(status);
create index if not exists waiter_calls_created_at_idx on waiter_calls(created_at desc);
