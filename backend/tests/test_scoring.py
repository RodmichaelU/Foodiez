import pytest

from app.core.scoring import contains_avoided, is_excluded, owned_ingredients, score_recipe


def test_full_match_scores_one() -> None:
    result = score_recipe(["egg", "tomato"], [], {"egg", "tomato"})

    assert result.score == 1.0
    assert (result.have_count, result.total_core, result.missing) == (2, 2, [])


def test_missing_core_is_penalized() -> None:
    result = score_recipe(["egg", "tomato"], [], {"egg"})

    assert result.score == pytest.approx(0.4)
    assert result.missing == ["tomato"]


def test_optional_ingredients_add_a_bonus() -> None:
    result = score_recipe(["egg"], ["chive", "cheddar"], {"egg", "chive"})

    assert result.score == pytest.approx(1.02)


def test_empty_core_does_not_divide_by_zero() -> None:
    assert score_recipe([], [], {"egg"}).score == 0.0


def test_duplicate_core_counts_once() -> None:
    assert score_recipe(["egg", "egg"], [], {"egg"}).total_core == 1


def test_staples_are_owned_only_when_enabled() -> None:
    assert owned_ingredients(["egg"], ["salt"], use_staples=True) == {"egg", "salt"}
    assert owned_ingredients(["egg"], ["salt"], use_staples=False) == {"egg"}


def test_two_missing_is_allowed_but_three_is_excluded() -> None:
    assert not is_excluded([], ["a", "b"], [])
    assert is_excluded([], ["a", "b", "c"], [])


def test_avoided_ingredient_excludes_recipe() -> None:
    assert is_excluded(["egg", "peanut"], [], ["peanut"])
    assert not is_excluded(["egg"], [], ["peanut"])


@pytest.mark.parametrize(
    ("name", "avoided"),
    [("peanut_butter", "peanut"), ("egg_noodle", "egg"), ("soy_sauce", "soy_sauce")],
)
def test_avoid_matches_whole_words_inside_longer_names(name: str, avoided: str) -> None:
    assert contains_avoided([name], [avoided])


def test_avoid_does_not_match_partial_words() -> None:
    assert not contains_avoided(["eggplant"], ["egg"])
