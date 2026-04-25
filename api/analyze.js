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

    systemPrompt = "당신은 중학교·고등학교 과학 교육 전문가입니다. 물리, 화학, 생물, 지구과학 전 분야에 능통합니다.\n주어진 원본 문제의 개념과 법칙/공식을 활용하여 비슷한 유형의 새 문제 1개를 만드세요.\nJSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.\n\n응답 형식:\n{\"problems\":[{\"title\":\"문제 제목\",\"grade\":\"학년\",\"unit\":\"단원명\",\"difficulty\":\"하/중/상\",\"tags\":[\"태그\"],\"problemText\":\"문제 전문 (학생이 풀 수 있도록 명확하게)\",\"solutionSteps\":[{\"num\":1,\"title\":\"단계명\",\"math\":\"수식/화학식/법칙\",\"explain\":\"설명\"}],\"finalAnswer\":\"핵심질문 = 답\",\"keyConcepts\":[\"개념\"],\"keyFormulas\":[\"공식/법칙\"],\"tip\":\"학습 팁\"}]}\n\n" + symbolGuide + "\n\n★★★ 가장 중요한 규칙: 텍스트만으로 완전한 문제 작성 ★★★\n이 문제는 텍스트만으로 제공되며 그림/도표/그래프/사진이 없습니다.\n따라서 problemText에 다음 표현을 절대 사용하지 마세요:\n- 금지: '그림은...', '다음 그림에서...', '그림과 같이...', '아래 그림을 보고...'\n- 금지: '표에서...', '다음 표를 보고...', '그래프에서...', '다음 그래프는...'\n- 금지: '위 사진은...', '실험 장치는 그림과 같다'\n\n대신, 모든 조건과 상황을 문장으로 서술하세요. 과목별 작성 예시:\n\n[지구과학] ❌ 나쁜 예: '그림은 어떤 지역에서 공기가 순환하는 모습이다. A지역은...'\n✅ 좋은 예: '해안 도시에서 낮 동안 육지 표면 온도가 35℃, 바다 표면 온도가 22℃이다. (1) 육지와 바다 위 공기의 상승·하강 방향을 쓰시오. (2) 지표면 근처 바람의 방향을 쓰시오. (3) 이 바람의 명칭을 쓰시오.'\n\n[물리] ❌ 나쁜 예: '그림과 같이 빗면 위에 물체가 놓여 있다.'\n✅ 좋은 예: '경사각 30°인 마찰 없는 빗면 위에 질량 2kg인 물체가 정지해 있다. 물체에 작용하는 빗면 방향의 중력 성분과 수직 항력의 크기를 각각 구하시오. (g = 10m/s²)'\n\n[생물] ❌ 나쁜 예: '다음 그림은 세포 분열 과정을 나타낸 것이다.'\n✅ 좋은 예: '체세포 분열에서 염색체 수가 2n=46인 사람의 세포가 분열할 때, G₁기, S기, G₂기, 분열기(M기) 각 단계에서 DNA 양의 변화를 설명하고, 분열 완료 후 딸세포의 염색체 수를 구하시오.'\n\n[화학] ❌ 나쁜 예: '다음 표는 원소 A, B의 전자 배치를 나타낸 것이다.'\n✅ 좋은 예: '원자번호 11인 원소 A와 원자번호 17인 원소 B가 있다. (1) 각 원소의 전자 배치를 쓰시오. (2) 두 원소가 결합할 때 형성되는 화합물의 화학식을 쓰시오. (3) 이 결합의 종류를 쓰시오.'\n\n기타 규칙:\n- 반드시 1개의 문제를 생성하세요.\n- 원본과 같은 개념/법칙을 사용하되 숫자나 조건을 변경하세요.\n- 난이도는 원본과 비슷하게 유지하세요.\n- solutionSteps는 3~6단계로 작성하세요.\n- finalAnswer는 핵심 질문과 답만 간결하게 쓰세요.";

    messages = [{
      role: "user",
      content: "아래 원본 문제를 참고하여 비슷한 유형의 문제 1개를 만들어주세요.\n\n" + problemContext,
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
