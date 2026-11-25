from datetime import date, timedelta

from anchor.services.metrics import HabitData, hold_rate, longest_streak, overview, sea_state, streak

TODAY = date(2026, 11, 24)


def habit(done_offsets, start=-30, end=None, hid=1):
    return HabitData(
        id=hid, title=f"H{hid}", notes="", start=TODAY + timedelta(days=start),
        end=TODAY + timedelta(days=end) if end is not None else None, color="#5EC8E5",
        done={TODAY + timedelta(days=o) for o in done_offsets},
    )


def test_streak_counts_through_yesterday_when_today_not_logged():
    assert streak(habit([-1, -2, -3]), TODAY) == 3


def test_streak_includes_today_when_logged():
    assert streak(habit([0, -1, -2]), TODAY) == 3


def test_streak_stops_at_gap():
    assert streak(habit([0, -1, -3, -4]), TODAY) == 2


def test_streak_stops_at_start_date():
    assert streak(habit([0, -1, -2, -3], start=-1), TODAY) == 2


def test_longest_streak():
    assert longest_streak(habit([-10, -9, -8, -2, -1])) == 3


def test_hold_rate_ignores_unlogged_today():
    h = habit([-1, -2, -3, -4, -5, -6])
    assert hold_rate([h], TODAY, 7) == 1.0


def test_hold_rate_counts_today_once_done():
    h = habit([0, -1])
    assert hold_rate([h], TODAY, 3) == 2 / 3


def test_hold_rate_none_when_nothing_due():
    assert hold_rate([habit([], start=5)], TODAY, 7) is None


def test_sea_state_thresholds():
    assert sea_state(None) == "calm"
    assert sea_state(0.8) == "calm"
    assert sea_state(0.75) == "calm"
    assert sea_state(0.6) == "open"
    assert sea_state(0.44) == "storm"


def test_overview_summary():
    habits = [habit([0, -1, -2], hid=1), habit([-1], hid=2), habit([], start=-3, end=-1, hid=3)]
    ov = overview(habits, [], TODAY)
    s = ov["summary"]
    assert s["due_today"] == 2
    assert s["done_today"] == 1
    assert not s["all_done"]
    assert s["best"] == {"habit_id": 1, "title": "H1", "days": 3}
    assert ov["habits"][2]["due_today"] is False
