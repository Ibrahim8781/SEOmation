from typing import List, Tuple, Dict

def seo_score_and_hints(platform: str, language: str, focus_keyword: str, content: str) -> Tuple[int, List[Dict[str,str]]]:
    score = 100
    hints = []
    lcont = (content or "").lower()
    if platform == "blog":
        if focus_keyword.lower() not in lcont:
            hints.append({"type":"keyword","msg":"Add focus keyword early and in H1"}); score -= 20
        if "<h2" not in lcont and "## " not in content:
            hints.append({"type":"structure","msg":"Add H2/H3 hierarchy"}); score -= 10
        if len(content.split()) < 800:
            hints.append({"type":"length","msg":"Increase length to reach target"}); score -= 10
    else:
        if len(content.split()) < 120:
            hints.append({"type":"length","msg":"Make it a bit longer"}); score -= 10
    return max(score, 0), hints
