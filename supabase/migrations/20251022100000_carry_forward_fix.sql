-- Helper function to calculate totals for a single day's record.
-- This mirrors the logic from the application's calculations.ts file.
create or replace function calculate_day_book_totals(
  p_record jsonb,
  p_previous_day_balance numeric
) returns numeric as $$
declare
  petrol_litres numeric;
  diesel_litres numeric;
  petrol_price numeric;
  diesel_price numeric;
  petrol_sale numeric;
  diesel_sale numeric;
  total_other_sales numeric;
  total_sale numeric;
  total_svi_sales numeric;
  total_sales0332 numeric;
  total_credit_sales numeric;
  total_credit numeric;
  cash_sale numeric;
  gas_testing_expense numeric;
  total_gas_commissions numeric;
  total_additional_expenses numeric;
  total_expenses numeric;
  net_sale numeric;
  total_cash_deposits numeric;
  total_payments numeric;
  total_cash_in numeric;
  total_cash_out numeric;
  day_balance numeric;
begin
  -- Extract prices, coalescing NULL to 0
  petrol_price := coalesce((p_record->'prices'->>'petrol')::numeric, 0);
  diesel_price := coalesce((p_record->'prices'->>'diesel')::numeric, 0);

  -- Calculate litres sold safely
  select coalesce(sum(greatest(0, (m->>'closingReading')::numeric - (m->>'openingReading')::numeric)), 0)
  into petrol_litres
  from jsonb_array_elements(p_record->'machines'->'petrol') as m;

  select coalesce(sum(greatest(0, (d->>'closingReading')::numeric - (d->>'openingReading')::numeric)), 0)
  into diesel_litres
  from jsonb_array_elements(p_record->'machines'->'diesel') as d;

  petrol_sale := ceil(petrol_litres * petrol_price);
  diesel_sale := ceil(diesel_litres * diesel_price);

  -- Other Sales
  select coalesce(sum((s->>'amount')::numeric), 0)
  into total_other_sales
  from jsonb_array_elements(p_record->'otherSales') as s;

  total_sale := petrol_sale + diesel_sale + total_other_sales;

  -- Deductions (Credit)
  select coalesce(sum((svi->>'amount')::numeric), 0) into total_svi_sales from jsonb_array_elements(p_record->'deductions'->'sviSales') as svi;
  select coalesce(sum((s0332->>'amount')::numeric), 0) into total_sales0332 from jsonb_array_elements(p_record->'deductions'->'sales0332') as s0332;
  select coalesce(sum((cs->>'amount')::numeric), 0) into total_credit_sales from jsonb_array_elements(p_record->'deductions'->'creditSales') as cs;
  total_credit := total_svi_sales + total_sales0332 + total_credit_sales;

  cash_sale := total_sale - total_credit;

  -- Expenses
  gas_testing_expense :=
    (coalesce((p_record->'expenses'->'gasTesting'->>'petrolTestLitres')::numeric, 0) * petrol_price) +
    (coalesce((p_record->'expenses'->'gasTesting'->>'dieselTestLitres')::numeric, 0) * diesel_price);

  select coalesce(sum((gc->>'amount')::numeric), 0) into total_gas_commissions from jsonb_array_elements(p_record->'expenses'->'gasCommissions') as gc;
  select coalesce(sum((ae->>'amount')::numeric), 0) into total_additional_expenses from jsonb_array_elements(p_record->'expenses'->'additionalExpenses') as ae;

  total_expenses := total_gas_commissions + total_additional_expenses + gas_testing_expense;
  net_sale := cash_sale - total_expenses;

  -- Payments
  select coalesce(sum((cd->>'amount')::numeric), 0) into total_cash_deposits from jsonb_array_elements(p_record->'payments'->'cashDeposits') as cd;

  total_payments :=
    coalesce((p_record->'payments'->>'atmSale')::numeric, 0) +
    coalesce((p_record->'payments'->>'phonePeSale')::numeric, 0) +
    coalesce((p_record->'payments'->>'paytmSale')::numeric, 0) +
    coalesce((p_record->'payments'->>'directPnbTransfer')::numeric, 0) +
    coalesce((p_record->'payments'->>'ioclCardSale')::numeric, 0) +
    total_cash_deposits;

  -- Cash Transactions
  select
    coalesce(sum(case when t->>'type' = 'in' then (t->>'amount')::numeric else 0 end), 0),
    coalesce(sum(case when t->>'type' = 'out' then (t->>'amount')::numeric else 0 end), 0)
  into total_cash_in, total_cash_out
  from jsonb_array_elements(p_record->'cashTransactions') as t;

  -- Final Day Balance
  day_balance := net_sale - total_payments + total_cash_in - total_cash_out + p_previous_day_balance;

  return day_balance;
end;
$$ language plpgsql;


-- Main function to get the final carry-forward balance for a target date.
create or replace function get_carry_forward_balance(
  p_target_date date
) returns numeric as $$
declare
  last_settled_date date;
  start_date date;
  current_date date;
  running_balance numeric := 0;
  current_record_row record;
  v_user_id uuid := auth.uid();
begin
  -- Step 1: Find the last date *before* the target date where cash was collected.
  select max(date)
  into last_settled_date
  from public.day_book_records
  where user_id = v_user_id
    and date < p_target_date
    and (record->>'cashCollected')::boolean = true;

  -- Step 2: If no settled day is found, find the earliest record date for this user.
  if last_settled_date is null then
    select min(date)
    into start_date
    from public.day_book_records
    where user_id = v_user_id;
    
    -- If there are no records at all, the balance is 0.
    if start_date is null then
      return 0;
    end if;
  else
    -- Start from the day *after* the last settled day.
    start_date := last_settled_date + interval '1 day';
  end if;

  -- If the start date is already at or after the target date, there's no carry-forward.
  if start_date >= p_target_date then
    return 0;
  end if;

  -- Step 3: Loop from the start_date up to the day *before* the target date.
  for current_record_row in
    select date, record from public.day_book_records
    where user_id = v_user_id and date >= start_date and date < p_target_date
    order by date asc
  loop
    -- If a record exists for this day and is not settled, calculate its balance and add to the running total.
    if not (current_record_row.record->>'cashCollected')::boolean then
        running_balance := calculate_day_book_totals(current_record_row.record, running_balance);
    else
        -- If we encounter a settled day, reset the balance and start fresh from its balance.
        running_balance := calculate_day_book_totals(current_record_row.record, 0);
        -- Since it's settled, this day's balance does NOT carry forward. So reset to 0 for next loop.
        running_balance := 0;
    end if;
  end loop;

  -- Step 4: Return the final accumulated balance.
  return running_balance;
end;
$$ language plpgsql security definer;
