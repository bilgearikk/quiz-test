import pandas as pd
import tempfile
from app import load_questions_from_excel

def _write_xlsx(df):
    tmp = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
    df.to_excel(tmp.name, index=False)
    return tmp.name

def test_excel_happy_path():
    df = pd.DataFrame([
        {"question":"Q?","option1":"A","option2":"B","option3":"C","option4":"D","correct_index":1},
    ])
    path = _write_xlsx(df)
    rows = load_questions_from_excel(path)
    assert rows[0]["question"] == "Q?"
    assert rows[0]["options"][1] == "B"
    assert rows[0]["correct"] == 1

def test_excel_missing_columns_raises():
    df = pd.DataFrame([{"question":"Q?","option1":"A"}])
    path = _write_xlsx(df)
    try:
        load_questions_from_excel(path)
        assert False, "Should have raised"
    except ValueError as e:
        assert "Excel must contain columns" in str(e)
