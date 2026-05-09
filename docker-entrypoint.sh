#!/bin/sh
# docker-entrypoint.sh — maps Docker env vars to main.py CLI flags.
set -e

CMD="python main.py --env ${ENV:-prod}"

# Disable live reload in production; keep it on in dev
[ "${ENV:-prod}" = "prod" ] && CMD="$CMD --no-reload"

[ -n "${PORT}" ]                      && CMD="$CMD --port ${PORT}"
[ -n "${CLOCK_TIME}" ]                && CMD="$CMD --clock_time ${CLOCK_TIME}"
[ -n "${IN_GAME_SECONDS_PER_TICK}" ]  && CMD="$CMD --in_game_seconds_per_tick ${IN_GAME_SECONDS_PER_TICK}"
[ -n "${RANDOM_SEED}" ]               && CMD="$CMD --random_seed ${RANDOM_SEED}"
[ "${INIT_TEST_PLAYERS}" = "true" ]   && CMD="$CMD --run_init_test_players"
[ "${DISABLE_SIGNUPS}" = "true" ]     && CMD="$CMD --disable_signups"
[ "${LOAD_CHECKPOINT}" = "true" ]     && CMD="$CMD --load_checkpoint"

exec $CMD
