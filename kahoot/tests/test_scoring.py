import math
from app import score_for_elapsed

def test_score_fast():
    assert score_for_elapsed(0.0) == 5
    assert score_for_elapsed(2.99) == 5

def test_score_medium():
    assert score_for_elapsed(3.01) == 3
    assert score_for_elapsed(5.0) == 3

def test_score_slow():
    assert score_for_elapsed(5.01) == 2
    assert score_for_elapsed(9.99) == 2

def test_score_timeout():
    assert score_for_elapsed(10.01) == 0
