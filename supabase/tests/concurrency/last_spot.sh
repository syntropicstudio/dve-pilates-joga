#!/usr/bin/env bash
# =============================================================================
# DVĚ – test souběhu: paralelní rezervace posledních míst
#
# POUZE LOKÁLNĚ. Připojuje se do lokálního kontejneru Supabase přes `docker exec`
# (výchozí název supabase_db_dve-pilates-joga), nikdy na vzdálený projekt.
#
# Scénář A: 30 paralelních transakcí rezervuje akci s kapacitou 3 (po 1 místě).
#           Každá transakce po vytvoření rezervace ještě 0,3 s drží zámek
#           (pg_sleep před COMMIT) → bez zámku řádku akce by došlo k přeplnění.
# Scénář B: souběžné opětovné potvrzování zrušených rezervací administrátorkou
#           a nové rezervace na akci s kapacitou 2.
# Scénář C: rezervace souběžně se snížením kapacity a následné zrušení akce.
#
# Spuštění:  bash supabase/tests/concurrency/last_spot.sh
# Testovací data po sobě smaže (jen řádky s vlastním slugem testu).
# =============================================================================
set -euo pipefail

CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_dve-pilates-joga}"
RUN_ID="$(date +%s)$RANDOM"
SLUG_A="concurrency-a-$RUN_ID"
SLUG_B="concurrency-b-$RUN_ID"
SLUG_C="concurrency-c-$RUN_ID"
ADMIN_ID="00000000-0000-0000-0000-$(printf '%012d' "$RANDOM$RANDOM" | cut -c1-12)"

psql_local() { docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Lokální kontejner $CONTAINER neběží. Spusť: npx supabase db start" >&2
  exit 2
fi

cleanup() {
  psql_local <<SQL >/dev/null || true
delete from public.reservations where event_id in (select id from public.events where slug in ('$SLUG_A', '$SLUG_B', '$SLUG_C'));
delete from public.events where slug in ('$SLUG_A', '$SLUG_B', '$SLUG_C');
delete from public.admin_profiles where id = '$ADMIN_ID';
delete from auth.users where id = '$ADMIN_ID';
SQL
}
trap cleanup EXIT

as_service='begin; set local role service_role; select set_config('"'"'request.jwt.claims'"'"', '"'"'{"role":"service_role"}'"'"', true);'
as_admin="begin; set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN_ID\",\"role\":\"authenticated\"}', true);"

FAIL=0
check() { # popis, očekávaná hodnota, skutečná hodnota
  if [[ "$2" == "$3" ]]; then echo "ok   – $1 ($3)"; else echo "FAIL – $1: očekáváno $2, skutečnost $3"; FAIL=1; fi
}

# ---------------------------------------------------------------- scénář A
EVENT_A=$(psql_local -c "insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity, status)
  values ('$SLUG_A', 'Souběh A', 'joga', now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 3, 'published')
  returning id;")

for i in $(seq 1 30); do
  psql_local -c "$as_service
    select public.create_reservation('$EVENT_A', 'Souběh $i', 'soubeh$i@example.com', '123456789', 1) ->> 'ok';
    select pg_sleep(0.3);
    commit;" >/dev/null &
done
wait

OK_A=$(psql_local -c "select count(*) from public.reservations where event_id = '$EVENT_A';")
BLOCKED_A=$(psql_local -c "select private.blocked_spots('$EVENT_A');")
check "A: vytvořené rezervace při kapacitě 3 a 30 souběžných požadavcích" 3 "$OK_A"
check "A: obsazenost nepřekročila kapacitu" 3 "$BLOCKED_A"

# ---------------------------------------------------------------- scénář B
psql_local <<SQL >/dev/null
insert into auth.users (id, email) values ('$ADMIN_ID', 'concurrency-admin-$RUN_ID@example.com');
insert into public.admin_profiles (id, email, display_name) values ('$ADMIN_ID', 'concurrency-admin-$RUN_ID@example.com', 'Souběh');
SQL
EVENT_B=$(psql_local -c "insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity, status)
  values ('$SLUG_B', 'Souběh B', 'joga', now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 2, 'published')
  returning id;")
# Dvě rezervace po 1 místě, obě zrušené → akce je volná.
CANCELLED=$(psql_local -c "insert into public.reservations (event_id, customer_name, customer_email, customer_phone, number_of_spots, reservation_status)
  values ('$EVENT_B', 'Zrušená Jedna', 'z1@example.com', '123456789', 1, 'cancelled'),
         ('$EVENT_B', 'Zrušená Dvě',  'z2@example.com', '123456789', 1, 'cancelled')
  returning id;")

for id in $CANCELLED; do
  psql_local -c "$as_admin
    select public.set_reservation_status('$id', 'confirmed') ->> 'ok';
    select pg_sleep(0.3);
    commit;" >/dev/null &
done
for i in $(seq 1 10); do
  psql_local -c "$as_service
    select public.create_reservation('$EVENT_B', 'Nová $i', 'nova$i@example.com', '123456789', 1) ->> 'ok';
    select pg_sleep(0.3);
    commit;" >/dev/null &
done
wait

BLOCKED_B=$(psql_local -c "select private.blocked_spots('$EVENT_B');")
check "B: potvrzování + nové rezervace nepřekročí kapacitu 2" 2 "$BLOCKED_B"

# ---------------------------------------------------------------- scénář C
# Souběžně: 10 nových rezervací, snížení kapacity z 6 na 3 a nakonec zrušení akce.
# Bez ohledu na pořadí nesmí obsazenost překročit platnou kapacitu a po zrušení
# akce už nesmí vzniknout žádná nová rezervace.
EVENT_C=$(psql_local -c "insert into public.events (slug, title, category, start_at, end_at, time_label, price, capacity, status)
  values ('$SLUG_C', 'Souběh C', 'joga', now() + interval '10 days', now() + interval '10 days 1 hour', '9:00–10:00', 100, 6, 'published')
  returning id;")
for i in $(seq 1 10); do
  psql_local -c "$as_service
    select public.create_reservation('$EVENT_C', 'Souběh C $i', 'c$i@example.com', '123456789', 1) ->> 'ok';
    select pg_sleep(0.2);
    commit;" >/dev/null &
done
# Snížení kapacity může legitimně selhat (capacity_below_reserved), pokud už je obsazeno víc než 3.
psql_local -c "begin; update public.events set capacity = 3 where id = '$EVENT_C'; select pg_sleep(0.2); commit;" >/dev/null 2>&1 &
wait
psql_local -c "update public.events set status = 'cancelled' where id = '$EVENT_C';" >/dev/null
LATE_C=$(psql_local -c "$as_service select public.create_reservation('$EVENT_C', 'Pozdní Zájemce', 'pozde@example.com', '123456789', 1) ->> 'code'; commit;" | tail -1)

OVER_C=$(psql_local -c "select (private.blocked_spots(id) > capacity)::text from public.events where id = '$EVENT_C';")
check "C: obsazenost nepřekročila kapacitu ani po souběžném snížení" false "$OVER_C"
check "C: na zrušenou akci už rezervace nevznikne" event_not_found "$LATE_C"

if [[ $FAIL -ne 0 ]]; then echo "Výsledek: FAIL"; exit 1; fi
echo "Výsledek: PASS"
