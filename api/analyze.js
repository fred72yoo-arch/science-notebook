module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64, mimeType, apiKey, mode, problemContext } = req.body;

  if (!apiKey) return res.status(400).json({ error: { message: "API 키가 필요합니다." } });

  /* ─── 공통 기호 가이드 (두 모드에서 재사용) ─── */
  const symbolGuide = [
    "기호 사용 규칙 (math 필드와 keyFormulas에 반드시 적용):",
    "- 화학 반응식: → (정반응), ← (역반응), ⇌ (가역반응/평형), ↑ (기체 발생), ↓ (침전)",
    "- 화학 아래첨자: 유니코드 사용. 예) H₂O, CO₂, Ca(OH)₂, CH₃COOH, SO₄²⁻",
    "- 이온 전하: 유니코드 위첨자 사용. 예) Na⁺, Cl⁻, Fe²⁺, Fe³⁺, SO₄²⁻, Cu²⁺",
    "- 수화물: 가운뎃점 사용. 예) CuSO₄·5H₂O",
    "- 물리 그리스 문자: α(각가속도), β, γ(감마선), Δ(변화량), θ(각도), λ(파장), μ(마찰계수), ν(진동수), ρ(밀도), σ(응력), τ(토크), φ(전위), ω(각속도), η(효율), Ω(옴)",
    "- 물리 대문자: Σ(합), Φ(자기선속), Δ(변화량: ΔT, ΔH, ΔG)",
    "- 비례/관계: ∝ (비례), ≈, ≠, ≤, ≥",
    "- 기하/방향: ∥ (평행), ⊥ (수직), ∠ (각), ° (도)",
    "- 단위: m/s², kg, N, J, W, Pa, mol, ℃, eV, Hz 등 반드시 포함",
    "- 생물 성별: ♀ (암컷), ♂ (수컷)",
    "- 논리: ∴ (그러므로), ∵ (왜냐하면)",
    "- 수학 공통: ±, ×, ÷, √, ², ³, π, ∞",
  ].join("\n");

  /* ─── 모드별 프롬프트 분기 ─── */
  let systemPrompt, messages;

  if (mode === "generate_similar") {
    if (!problemContext) return res.status(400).json({ error: { message: "문제 정보가 필요합니다." } });

    systemPrompt = "당신은 중학교·고등학교 과학 교육 전문가입니다. 물리, 화학, 생물, 지구과학 전 분야에 능통합니다.\n주어진 원본 문제의 개념과 법칙/공식을 활용하여 비슷한 유형의 새 문제 2개를 만드세요.\nJSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.\n\n응답 형식:\n{\"problems\":[{\"title\":\"문제 제목\",\"grade\":\"학년\",\"unit\":\"단원명\",\"difficulty\":\"하/중/상\",\"tags\":[\"태그\"],\"problemText\":\"문제 전문 (학생이 풀 수 있도록 명확하게)\",\"solutionSteps\":[{\"num\":1,\"title\":\"단계명\",\"math\":\"수식/화학식/법칙\",\"explain\":\"설명\"}],\"finalAnswer\":\"핵심질문 = 답\",\"keyConcepts\":[\"개념\"],\"keyFormulas\":[\"공식/법칙\"],\"tip\":\"학습 팁\"}]}\n\n" + symbolGuide + "\n\n규칙:\n- 반드시 2개의 문제를 생성하세요.\n- 원본과 같은 개념/법칙을 사용하되 숫자나 조건을 변경하세요.\n- 난이도는 원본과 비슷하게 유지하세요.\n- solutionSteps는 3~6단계로 작성하세요.\n- problemText는 학생이 읽고 바로 풀 수 있을 정도로 명확하고 완전하게 작성하세요.\n- finalAnswer는 핵심 질문과 답만 간결하게 쓰세요. 예: \"가속도 = 2m/s²\", \"반응 생성물의 질량 = 36g\", \"우성 형질 비율 = 75%\"";

    messages = [{
      role: "user",
      content: "아래 원본 문제를 참고하여 비슷한 유형의 문제 2개를 만들어주세요.\n\n" + problemContext,
    }];
  } else {
    if (!imageBase64) return res.status(400).json({ error: { message: "이미지가 필요합니다." } });

    systemPrompt = "당신은 중학교·고등학교 과학 교육 전문가입니다. 물리, 화학, 생물, 지구과학 전 분야에 능통합니다.\n학생이 업로드한 과학 문제 이미지를 분석하고 아래 JSON 형식으로만 응답하세요.\nJSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.\n\n{\"title\":\"문제 요약 제목\",\"grade\":\"학년(중1/중2/중3/고1/고2/고3)\",\"unit\":\"단원명\",\"difficulty\":\"하 또는 중 또는 상\",\"tags\":[\"태그\"],\"problemText\":\"문제 원문\",\"errorStep\":null,\"errorAnalysis\":null,\"solutionSteps\":[{\"num\":1,\"title\":\"단계명\",\"math\":\"수식/화학식/법칙\",\"explain\":\"설명\"}],\"finalAnswer\":\"문제의 최종 질문 = 답\",\"keyConcepts\":[\"개념\"],\"keyFormulas\":[\"공식/법칙\"],\"tip\":\"학습 팁\"}\n\n" + symbolGuide + "\n\n규칙:\n- 풀이가 포함된 이미지면 학생의 오류를 찾아 errorStep(번호)과 errorAnalysis(설명)를 채우세요.\n- 문제만 있으면 올바른 풀이를 작성하고 errorStep/errorAnalysis는 null로 두세요.\n- solutionSteps는 3~6단계로 작성하세요.\n- 과학 분야(물리/화학/생물/지구과학)를 자동 감지하여 적절한 단원명을 지정하세요.\n- finalAnswer는 문제가 묻는 핵심 질문과 최종 답을 간결하게 작성하세요. 예시: \"가속도 = 3m/s²\", \"생성물의 질량 = 36g\", \"우성 형질 비율 = 75%\", \"진앙까지의 거리 = 120km\". 수식 전개 과정은 포함하지 말고, 질문과 답만 쓰세요.";

    messages = [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageBase64 } },
        { type: "text", text: "이 과학 문제를 분석해주세요. 풀이가 있다면 틀린 부분을 찾아주세요." },
      ],
    }];
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: { message: error.message || "서버 오류" } });
  }
};
